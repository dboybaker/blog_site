---
title: "Local LLM Finetuning Experiments"
date: 2026-07-13T12:00:00Z
publishDate: 2026-07-13T12:00:00Z
draft: false
tags: ["llm", "finetuning", "qwen", "gemma", "llama-factory", "unsloth", "mediawiki", "dataset"]
summary: "Fine-tuning small LLMs on consumer hardware: from unsloth CLI to LLaMA-Factory with ZeRO-2."
cardImage: ""
---
{{< ctx-bar >}}
Tested in this article: Qwen2.5-3B, Gemma4-e2b, Qwen3.5-4b
---
<span><strong>Hardware</strong> RTX 3090 · 24 GB</span>
<span><strong>OS</strong> Debian 13</span>
<span><strong>Frameworks</strong> Unsloth CLI, LLaMA-Factory, ZeRO-2</span>
{{< /ctx-bar >}}

## The Motivation

I genuinely believe the future of LLMs is open and local. Individuals and organizations will train/tune 'small' models into capable and efficient agents in their own ecosystem. I wanted to get some hands on experience with this process, so I set off to experiment how I could with the hardware I have. Could I meaningfully improve a small model's knowledge or instruction-following capability at home?

This article documents three phases of experimentation: a warm-up fine-tune using Unsloth, building a custom instruction-following dataset from scratch, and then pushing deeper with LLaMA-Factory and ZeRO-2.

## Phase 1: Warm-Up with Unsloth

### The Setup

**Model:** Qwen2.5-3B-Instruct
**Dataset:** Databricks Dolly 15K
**Framework:** Unsloth CLI
**Hardware:** Single RTX 3090 (24 GB VRAM)

[Databricks Dolly 15K](https://huggingface.co/datasets/databricks/databricks-dolly-15k) is a popular instruction-following dataset with 15,000 human-generated training samples across several task categories. It looked to be a solid starting point for warm-up fine-tuning experiments.

Unsloth provides a CLI-based workflow that makes it straightforward to kick off a fine-tuning job with minimal configuration. The library is known for its memory optimizations, enabling training on smaller consumer GPUs. One important caveat I learned along the way: the free tier of Unsloth only accelerates single-GPU training. The multi-GPU scaling kernels are a commercial feature. Since this was a warm-up run, I deliberately kept it to a single card to minimize complexity, which is reflected in the config below.

### Configuration

- **LoRA rank:** 16
- **Alpha:** 16
- **LoRA dropout:** 0
- **Target modules:** all linear (q, k, v, o, gate, up, down)
- **Learning rate:** 2e-4
- **LR scheduler:** linear
- **Epochs:** 1
- **Per-device batch size:** 4
- **Gradient accumulation:** 4 (effective batch size 32)
- **Sequence length:** 2048
- **Optimizer:** adamw_8bit
- **Quantization:** 4-bit (QLoRA)
- **Warmup steps:** 10
- **Trainable parameters:** 29,933,568 of 3,115,872,256 (0.96% trained)

### Results

The run completed in a single epoch (446 steps on one 3090).

<img src="dolly_15k_loss_graph_dark.png" alt="training loss and eval loss">

- **Training loss:** started around 2.40 and settled to roughly 1.45–1.55 by the end of the epoch.
- **Eval loss:** declined steadily across all eight validation checkpoints, from 1.561 down to 1.526.
- **Overfitting check:** training and eval loss decreased together throughout, so no signs of overfitting on this single-epoch run.

The numbers were healthy, but the qualitative test was the more interesting result. Comparing the base Qwen2.5-3B against the fine-tune on a prompt from the training distribution, the behavioral shift was obvious. The base model produced a "helpful, conversation, and chatty assistant" style verbose multi-sentence paragraph, whereas the fine-tune gave a succinct, Dolly-style answer:

> **Base:** "Virgin Australia started operating on August 31, 2000, under the trading name Virgin Blue. At that time, it operated with only two aircraft on a single route..."
>
> **Fine-tuned:** "Virgin Australia started operating in 2000."

The same behavior generalized to a *novel* prompt the model hadn't been trained on. Asked about Delta Air Lines, the base model rambled through a (partly hallucinated) history while the fine-tune produced the same clipped format: "Delta Air Lines was formed in 1929." The short-answer *style* of the Dolly dataset had clearly transferred to unseen questions: a textbook demonstration of what supervised fine-tuning actually does. It adjusts behavior and format, not the underlying knowledge. (A lesson that would come back to bite in a much bigger way in Phase 3.)

Getting there was its own education. This phase involved a gauntlet of environment and compatibility issues — a broken FlashAttention install falling back to Xformers, a deprecated `evaluation_strategy` argument, a transformers/Unsloth `.mean()` incompatibility on the fused loss, a CUDA OOM from tokenizer process forking, and an SFTConfig pickling error on checkpoint save. Working through them was where most of the actual learning happened.

## Phase 2: Building a Custom Dataset


The goal for Phase 2 was to create a larger, more diverse dataset for something I'm interested in. One where a small trained model might actually be useful to me. Ideally one that didn't exist already. I chose the [OldSchool RuneScape Wiki](https://oldschool.runescape.wiki/) as the source material. The game has a rich knowledge base with structured content covering gameplay mechanics, items, skills, quests, and more (plus my unreasonably extensive personal knowledge of the game would assist in evaluation).

The plan had two distinct stages: **scrape** the raw wiki content, then **transform** it into formatted question/answer pairs using a frontier model.

### Step 1: Scraping the OSRS Wiki

The wiki runs on MediaWiki, which exposes a proper API. As a result there was no need for fragile HTML scraping. Pulling content through the MediaWiki API (rather than parsing rendered pages) gives clean article text and avoids hammering the site with rendered page requests.

The scrape pulled **27,860 articles**, saved as a simple JSONL of `{title, text}` records with one row per wiki page. This raw scrape became both the input to the dataset-generation step and, much later, the source material for the RAG knowledge base after Phase 3.

### Step 2: Generating the Dataset with Claude Sonnet (Batch API)

This is the stage that turned raw wiki text into a training set. For each article, the goal was to generate several instruction/context/response examples across different task categories, all in the target format:

```json
{"instruction": "", "context": "", "response": "", "category": ""}
```

**Why a frontier model instead of a local one?** I have a perfectly capable local inference rig, and generating the dataset locally would have cost nothing but electricity. I chose to pay for Claude Sonnet via the API anyway, for two reasons: **speed** and **quality**. Generating ~93K high-quality, correctly-formatted examples locally would have taken a very long time on a 3090, and the output quality, especially adherence to the JSON schema and the factual grounding of the responses, is meaningfully better from a frontier model. For a dataset I intended to publish and actually train on, that trade was worth it.

To keep costs down, the generation ran through the **Batch API**, which offers a 50% discount over standard synchronous pricing in exchange for asynchronous processing. Each article was sent with a system prompt instructing the model to produce examples across the task categories (factual/closed-QA, open-QA, classification, brainstorming, generation), with the wiki text supplied as source material.

**The numbers:**

| Metric | Value |
|---|---|
| Wiki articles scraped | 27,860 |
| Final dataset examples | 93,549 |
| Avg. examples per article | ~3.4 rows per page |
| Input tokens | 34,561,082 |
| Output tokens | 20,469,226 |
| Total tokens | ~55 million |
| Model | claude-sonnet-4-6 |
| Cost (Batch API) | **$205.36** |
| Cost at standard rates | $410.72 |

At Sonnet 4.6's standard rate of $3.00 per million input tokens and $15.00 per million output tokens, this workload would have cost $103.68 for input and $307.04 for output ($410.72 total). Running it through the Batch API halved that to **$205.36**. The 50% batch discount is essentially free money for a job like this: dataset generation can be done fully parallel and has no latency requirement, so trading synchronous responses for a processing window is a no-brainer.

---



### Data Sanitization

One implementation detail worth recording because it stalled the batch: the Batch API requires each request to carry a `custom_id`, and that ID has strict rules. It only supports alphanumerics, underscores, and hyphens only, and a **64-character limit**. My first attempt derived the `custom_id` from the article title, which broke on two fronts: titles with special characters (apostrophes, ampersands, parentheses which are common in OSRS quest names) and very long titles that blew past the 64-character ceiling. The fix was a small sanitization function that strips non-conforming characters, collapses whitespace to underscores, and clips the title to fit under the limit while preserving the request-type prefix and row index. Minor, but it's the kind of thing that silently fails a whole batch if you don't catch it.

### What the Dataset Looks Like

The result is a genuinely dense, domain-specific instruction set. 93,549 examples built from clean wiki source text, spanning multiple task types rather than just Q&A. Compared to the 15,000-row Dolly set that inspired the project, it's over six times the size and far more focused.

I published the dataset to Hugging Face at [`dboybaker/osrs-wiki-it-93k`](https://huggingface.co/datasets/dboybaker/osrs-wiki-it-93k).

### Dataset Structure

Each record contains four fields: `instruction`, `context`, `response`, and `category`. The `context` field carries supporting wiki text for grounded categories and is empty for categories that rely on general game knowledge. Following the behavioral categories outlined in the the InstructGPT-style task taxonomy popularized by Dolly, I structured the dataset around several instruction-following task types:

| Category | Description | Count |
|---|---|---|
| **Brainstorming** | Generate creative ideas, strategies, or lists based on game content | 3,483 |
| **Classification** | Categorize items, skills, or gameplay elements | 632 |
| **Closed QA** | Factual questions with specific answers from wiki content | 33,293 |
| **Generation** | Open-ended content creation based on game mechanics | 7,510 |
| **Information Extraction** | Pull structured data from wiki articles | 18,246 |
| **Open QA** | Broad questions requiring synthesized answers | 23,530 |
| **Summarization** | Condense lengthy wiki articles into concise summaries | 6,855 |
| **Total** | | **93,549** |

## Phase 3: SFT with LLaMA-Factory

### The Setup

**Models:** Gemma4-e2b, Qwen3.5-4b
**Dataset:** Custom OSRS Wiki dataset (93K records)
**Framework:** LLaMA-Factory
**Memory Optimization:** ZeRO-2 (via DeepSpeed)
**Hardware:** 2× RTX 3090 (24 GB VRAM each), PCIe x8, no NVLink

The move from Unsloth to LLaMA-Factory was driven by a specific hardware goal: I wanted to actually use both of my 3090s. Unsloth's memory optimizations are excellent but its multi-GPU story is weak. In practice it seems each GPU runs a full model copy, so you get throughput but no additive VRAM. LLaMA-Factory paired with DeepSpeed ZeRO-2 was the cleanest path to real dual-GPU training.

A note on the interconnect: my two 3090s run on PCIe x8 with no NVLink, so inter-GPU communication goes over the PCIe bus rather than a dedicated high-speed link. This matters for framework choice. ZeRO-3 sharding hammers the interconnect and would have been bottlenecked on PCIe. On the other hand, ZeRO-2 (which shards optimizer states and gradients but replicates model weights) is the sweet spot for a small model on PCIe-linked consumer cards. For a 2B–4B model with LoRA, the full model fits comfortably on each card anyway, so there's no need for the heavier sharding ZeRO-3 provides.

[LLaMA-Factory](https://github.com/hiyouga/LLaMA-Factory) is a unified training framework supporting a wide variety of open-source LLMs. Paired with DeepSpeed's ZeRO-2 optimization, it becomes feasible to fine-tune models on consumer hardware by partitioning optimizer states and gradients across available resources.

### ZeRO-2 Configuration

The DeepSpeed config was deliberately kept simple, with one deliberate choice worth highlighting: no CPU optimizer offloading. For a 2B–4B model with LoRA on dual 24GB cards, there's plenty of VRAM headroom. Offloading to CPU on a PCIe-constrained setup would have added *more* bus traffic, not less. The `overlap_comm: true` setting was the main PCIe mitigation. It overlaps gradient communication with the backward pass, which meaningfully reduces time spent waiting on the bus when you don't have NVLink.

```json
{
  "train_batch_size": "auto",
  "train_micro_batch_size_per_gpu": "auto",
  "gradient_accumulation_steps": "auto",
  "gradient_clipping": "auto",
  "zero_optimization": {
    "stage": 2,
    "allgather_partitions": true,
    "allgather_bucket_size": 2e8,
    "overlap_comm": true,
    "reduce_scatter": true,
    "reduce_bucket_size": 2e8,
    "contiguous_gradients": true,
    "offload_optimizer": {
      "device": "none"
    }
  },
  "bf16": {
    "enabled": true
  },
  "zero_allow_untested_optimizer": true
}
```

Gradient checkpointing was enabled (LLaMA-Factory turns this on automatically for LoRA runs), which trades a bit of recompute for a substantial reduction in activation memory.

### Training Configuration

Both models used identical LoRA hyperparameters and the same effective global batch size of 32. The Qwen run used a smaller per-device batch with more gradient accumulation to stay within memory once the larger 4B model and its (frozen) vision components were loaded. Gemma4-e2b and Qwen3.5-4b are natively multimodal checkpoints and LLaMA-Factory automatically freezes the vision and audio towers for text-only SFT, so only the language-model layers were trained.

| Parameter | Gemma4-e2b | Qwen3.5-4b |
|---|---|---|
| LoRA rank | 32 | 32 |
| Alpha | 64 | 64 |
| LoRA dropout | 0.05 | 0.05 |
| LoRA target | all linear | all linear |
| Learning rate | 2e-4 | 2e-4 |
| LR scheduler | cosine | cosine |
| Warmup ratio | 0.05 | 0.05 |
| Epochs | 3 | 1 |
| Per-device batch size | 2 | 2 |
| Gradient accumulation | 8 | 8 |
| Effective global batch | 32 | 32 |
| Sequence length (cutoff) | 2048 | 2048 |
| Precision | bf16 | bf16 |
| Attention backend | SDPA | SDPA |
| Trainable params | ~52.7M (1.02%) | — |
| Training time | ~11 hr (3 epochs) | ~7 hr (1 epoch) |
| Final loss | 0.62 | ~0.80 |

A couple of the entries above deserve context. I ran Gemma for the full 3 epochs first; its loss fell from 3.26 to 0.62, an 81% reduction, with clean convergence and no overfitting signs by epoch 3. Qwen was run for a single epoch as a faster comparison pass. The plan was to commit to a longer run only if the 1-epoch results looked promising.

**On the attention backend:** I originally configured FlashAttention-2, but hit two blockers. First, flash-attn wouldn't build cleanly against my CUDA/Python 3.13 setup (the compile kept getting OOM-killed by parallel nvcc jobs — solvable with `MAX_JOBS`, but a hassle). Second and more decisively, Gemma 4's vision tower has an attention path that passes a `None` where FA2 expects a tensor, crashing the forward pass on the first training step. Switching to PyTorch's built-in SDPA sidestepped both problems with negligible throughput cost at this model size.

### Observations

**Both models trained beautifully and both failed identically at inference, which turned out to be the most important result of the whole experiment.**

The training metrics were excellent. Gemma's loss curve was textbook: a rapid drop from 3.26 to ~1.0 during warmup, a steady grind through epoch 1, and clear step-downs at each epoch boundary as the shuffled data was revisited. I built a held-out eval set of 78 examples and computed perplexity for the Gemma finetune against the base model: **35.43 → 3.25, a ~91% reduction.** On paper, a spectacular result.

In practice, it was a bust. Every question returned fluent, confident, OSRS-flavored nonsense. Asked what an amulet of glory is, the model claimed it was a combat-stat booster requiring level 60 Defence (it's mainly a teleport amulet with no requirements). Asked how to reach Commander Zilyana, it invented a "Combat Ring" in the Wilderness. The outputs had perfect OSRS *surface form* and completely fabricated *content*.

Swapping to a dense 4B Qwen model produced the exact same failure. That's the key data point: **two completely different architectures failing identically rules out the model as the cause and points at a conceptual mismatch in what SFT can do.**


## Lessons Learned

The core lesson is well documented, but I needed to learn it the hard way. Supervised fine-tuning teaches a model *behavior, style, and format*, not *facts*. Training a small model on 93K OSRS facts, each appearing roughly once, doesn't build a reliable factual lookup in the weights. It teaches the model the *texture* of an OSRS answer: the confident tone, the right vocabulary, the wiki-style structure. So at inference the model reproduces the form perfectly and hallucinates the content. The perplexity eval wasn't lying, the model genuinely learned the *distribution* of the data. It just turns out "learning the distribution" of a Q&A set means learning the answer *style*, not the answer *facts*.

The fix all along was RAG. Embedding the raw wiki scrape into a vector knowledge base and retrieving relevant articles at query time supplies the correct facts in-context. Combined with the fine-tuned model's trained skill of turning OSRS source text into clean, well-structured answers the model feels amazing. Fine-tuning for *form* plus retrieval for *facts* is the combination that actually works.

{{< verdict >}}
<p class="verdict-lead">Conclusion</p>
It is certainly possible to fine tune a small model on consumer hardware, but expect it to take a lot of time even with the smallest models. It's also critical to understand what fine-tuning can actually accomplish. You aren't going to teach a model new information, thats for the domain of pre-training, but you can certainly teach it how to better respond with information it is provided.
{{< /verdict >}}

---