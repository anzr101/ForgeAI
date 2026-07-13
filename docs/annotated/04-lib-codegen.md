# 04 — `src/lib/codegen.ts` — the real-code generator

The bridge from simulation back to reality. Given the current config, these functions emit a
**genuinely runnable** training pipeline. This is the file that makes Forge more than a toy.

---

## `CodegenInput` and the `py()` helper

```ts
export interface CodegenInput { model: ModelArch; dataset: DatasetInfo; lora: LoraConfig;
                                train: TrainConfig; runName: string }
const py = (b: boolean) => (b ? 'True' : 'False')      // JS bool → Python literal
```
▸ `CodegenInput` is the bundle the Export screen assembles from the store. Everything the
generators need travels in this one object.
▸ `py()` prints JS booleans as Python's capitalized `True`/`False` when interpolating into code.

---

## `generateRequirements(train)`

```ts
const lines = ['torch>=2.3.0','transformers>=4.44.0','datasets>=2.20.0','peft>=0.12.0',
               'trl>=0.9.6','accelerate>=0.33.0']
if (train.quant !== 'none') lines.push('bitsandbytes>=0.43.1')   // only needed for QLoRA
if (train.wandb)            lines.push('wandb>=0.17.0')          // only if W&B logging on
return lines.join('\n') + '\n'
```
▸ Produces `requirements.txt`. The dependency list is **conditional on the config**:
`bitsandbytes` is only added when quantizing (it provides 4/8-bit), and `wandb` only when the
user enabled W&B logging. This is a small but real example of config-driven output.

---

## `generateTrainPy(input)` — the star

Assembles a full SFT script as a template string. Key computed pieces:

```ts
const steps  = totalSteps(dataset.rows, train)          // for the "~N steps" comment
const warmup = Math.round(steps * train.warmupRatio)    // warmupRatio → warmup_steps (real arg)
const targets = lora.targets.map(t => `"${t}"`).join(', ')   // → LoraConfig target_modules
const quantBlock = train.quant === 'none'
  ? 'bnb_config = None'
  : `bnb_config = BitsAndBytesConfig( load_in_4bit=${py(quant==='4bit')},
        load_in_8bit=${py(quant==='8bit')}, bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True, bnb_4bit_compute_dtype=torch.bfloat16 )`
```
▸ `warmupRatio` (a fraction) is converted to an absolute `warmup_steps` — exactly what
`TrainingArguments` expects.
▸ `targets` is rendered as a Python list literal so `LoraConfig(target_modules=[...])` gets the
same modules you toggled in the UI.
▸ `quantBlock` is either `None` (plain LoRA) or a real `BitsAndBytesConfig` with NF4 double
quantization (QLoRA). The generated script branches the same way real QLoRA code does.

The emitted script body (abridged) and why each part is correct:

```python
model = AutoModelForCausalLM.from_pretrained(MODEL_ID, quantization_config=bnb_config,
            torch_dtype=torch.bfloat16, device_map="auto")
model.config.use_cache = False
# (QLoRA only) model = prepare_model_for_kbit_training(model)

peft_config = LoraConfig(r=<r>, lora_alpha=<alpha>, lora_dropout=<dropout>,
                         target_modules=[<targets>], bias="none", task_type="CAUSAL_LM")

dataset = load_dataset(DATASET_ID, split="train").map(format_example, ...)   # → single "text" field

args = TrainingArguments(num_train_epochs=<epochs>, per_device_train_batch_size=<batch>,
    gradient_accumulation_steps=<gradAccum>, learning_rate=<lr>, lr_scheduler_type="<sched>",
    warmup_steps=<warmup>, logging_steps=<...>, save_steps=<...>, bf16=True,
    gradient_checkpointing=True, optim="paged_adamw_8bit" | "adamw_torch",
    report_to="wandb"|"none", seed=<seed>)

trainer = SFTTrainer(model, args, train_dataset=dataset, peft_config=peft_config,
                     dataset_text_field="text", max_seq_length=<maxSeqLen>, tokenizer=tokenizer)
trainer.train()            # ≈ <steps> optimizer steps
trainer.save_model(OUTPUT_DIR)   # saves the LoRA adapter
```
▸ **Every `<…>` is interpolated from the config** — change a slider in the UI and this script
changes. The hyperparameter names are the *actual* HF/TRL argument names.
▸ `prepare_model_for_kbit_training` is only inserted for QLoRA (the `${quant==='none' ? '' : …}`
ternary), matching real practice.
▸ `optim` switches to `paged_adamw_8bit` for quantized runs (the memory-friendly optimizer QLoRA
uses) vs `adamw_torch` for full-precision.
▸ `format_example` is a real formatting function that maps `instruction/input/output` (or common
aliases) into a single supervised `text` field ending in the EOS token — the standard SFT recipe.

---

## `generateQuantizeScript(method, bits, model, runName)`

Returns a different script per method:

```ts
if (method === 'gguf')  → bash: merge adapter (AutoPeftModelForCausalLM.merge_and_unload),
                          clone llama.cpp, convert_hf_to_gguf.py, ./llama-quantize to Q<bits>_K_M
if (method === 'awq')   → python: AutoAWQForCausalLM.from_pretrained().quantize(w_bit=<bits>, …)
if (method === 'gptq')  → python: AutoGPTQForCausalLM + BaseQuantizeConfig(bits=<bits>, …)
```
▸ Each branch is the canonical toolchain for that format: **GGUF** for llama.cpp/Ollama (CPU/edge),
**AWQ** (activation-aware) and **GPTQ** for GPU serving via vLLM. `runName` threads through so the
paths line up with the training output dir.

---

## `generateNotebook(input)` — a real `.ipynb`

```ts
const cell = (source, type) => ({ cell_type:type, metadata:{}, ...(type==='code'
  ? {execution_count:null, outputs:[]} : {}), source: source.split('\n').map(...) })
const nb = { nbformat:4, nbformat_minor:5,
  metadata:{ colab:{gpuType:'T4'}, accelerator:'GPU', kernelspec:{name:'python3'} },
  cells:[ markdown title, pip install cell, %%writefile requirements.txt, the train.py code ] }
return JSON.stringify(nb, null, 1)
```
▸ Builds the Jupyter/Colab notebook JSON **by hand** (no library). `cell()` is a helper that
formats a source string into the notebook's line-array format and adds the right fields for
code vs markdown cells.
▸ The notebook metadata requests a **T4 GPU accelerator**, so "Open in Colab" lands ready to run.
▸ Its cells are: a title (markdown), a `pip install` line, a `%%writefile requirements.txt`, and
the full generated `train.py` — i.e. a self-contained runnable notebook.
▸ `JSON.stringify(nb, null, 1)` serializes it; the Export screen offers it as a `.ipynb` download.

---

**Takeaway:** codegen is a pure `config → string` transform. It closes the loop: the exact run you
tuned and watched in the simulator can be reproduced on real hardware. Next: the small utilities —
[`05-lib-format-io.md`](05-lib-format-io.md).
