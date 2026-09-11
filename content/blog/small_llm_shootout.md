---
title: "Small LLM Shootout"
date: 2026-09-11T12:00:00Z
publishDate: 2026-09-11T12:00:00Z
draft: false
tags: ["llm", "llama.cpp", "vllm", "benchmark", "small-models"]
summary: "Finding the best of recent small large language models"
cardImage: "card-image.png"
---

{{< ctx-bar >}}
<span><strong>Tested in this article: </strong> Spark-X2.5-1.7B, MiniCPM5-2B, LFM2.5-2.6B, Nanbeige4.2-3B, Spark-X2.5-4B, Ling-3.0-tiny, LFM2.5-8B-A1B, Qwen3.8-9B-Distill  </span>

<span><strong>Hardware:</strong> RTX 6000 Blackwell · 96 GB VRAM, 96 GB DDR4  </span>
<span><strong>OS:</strong> Debian 13  </span>
<span><strong>Engine:</strong> llama.cpp, vLLM  </span>
<span><strong>Benchmarks:</strong> BFCL v4, MMLU-Pro, IFEval, Arena-Hard, HumanEval+, MBPP+, (+ Pelican)</span>
{{< /ctx-bar >}}

<details>
<summary><strong>📊 Expand Model llama-server Config</strong></summary>

```sh
  Spark-X2.5-1.7B:
    ttl: 3000
    healthCheckTimeout: 600
    concurrencyLimit: 16
    env:
      - CUDA_VISIBLE_DEVICES=0
    cmd: >
      vllm serve /models/Spark-X2.5/1.7B
      --chat-template /models/Spark-X2.5/1.7B/chat_template.jinja
      --served-model-name Spark-X2.5-1.7B
      --port ${PORT}
      --max-model-len 128000
      --max-num-seqs 16
      --gpu-memory-utilization 0.6
      --enable-prefix-caching
      --trust-remote-code
      --enable-auto-tool-choice
      --tool-call-parser spark25
      --reasoning-parser qwen3
```

``` sh
  LFM2.5-2.6B:
    ttl: 300
    cmd: >
      /usr/local/bin/llama-server
      --port ${PORT}
      --model /models/LFM2.5-2.6B/LFM2.5-2.6B-BF16.gguf
      --ctx-size 131072
      -ngl 99
      --main-gpu 0
      --split-mode none
      --fit off
      --flash-attn on
      --temp 0.2 --top-k 80 --repeat-penalty 1.05
      --jinja
      --parallel 1
      --batch-size 4096
      --ubatch-size 2048
```

```sh
  Spark-X2.5-4B:
    ttl: 3000
    healthCheckTimeout: 600
    concurrencyLimit: 16
    env:
      - CUDA_VISIBLE_DEVICES=0
    cmd: >
      vllm serve /models/Spark-X2.5/4B
      --chat-template /models/Spark-X2.5/4B/chat_template.jinja
      --served-model-name Spark-X2.5-4B
      --port ${PORT}
      --max-model-len 128000
      --max-num-seqs 16
      --gpu-memory-utilization 0.6
      --enable-prefix-caching
      --trust-remote-code
      --enable-auto-tool-choice
      --tool-call-parser spark25
      --reasoning-parser qwen3
```

```sh
  MiniCPM5-2B:
    ttl: 300
    cmd: >
      /usr/local/bin/llama-server
      --port ${PORT}
      --model /models/MiniCPM5-2B/MiniCPM5-2B-BF16.gguf
      --ctx-size 131072
      -ngl 99
      --main-gpu 0
      --split-mode none
      --fit off
      --flash-attn on
      --temp 0.9 --top-p 0.95
      --jinja
      --parallel 1
      --batch-size 4096
      --ubatch-size 2048
```

```sh
  Ling-3.0-tiny:
    ttl: 300
    cmd: >
      /usr/local/bin/llama-server
      --port ${PORT}
      --model /models/ling3.0-tiny/Ling-3.0-tiny-bf16.gguf
      --ctx-size 262144
      -ngl 99
      --main-gpu 0
      --split-mode none
      --fit off
      --flash-attn on
      --temp 1.0 --top-p 0.95 --top-k 20
      --jinja
      --parallel 1
      --batch-size 4096
      --ubatch-size 2048
```

```sh
  Nanbeige4.2-3B:
    ttl: 3000
    healthCheckTimeout: 600
    concurrencyLimit: 4
    env:
      - CUDA_VISIBLE_DEVICES=0
    cmd: >
      /usr/local/bin/llama-server
      --model /models/nanbeige4.2-3B/Nanbeige_Nanbeige4.2-3B-bf16.gguf
      --port ${PORT}
      -ngl 99
      --fit off
      --main-gpu 0
      --split-mode none
      --ctx-size 262144
      --parallel 1
      --flash-attn on
      --cache-reuse 256
      --jinja
      --temp 0.6 --top-p 0.95 --top-k 20
      --batch-size 4096
      --ubatch-size 2048
```

```sh
  LFM2.5-8B-A1B:
    ttl: 300
    cmd: >
      /usr/local/bin/llama-server
      --port ${PORT}
      --model /models/LFM2.5-8B-A1B/LFM2.5-8B-A1B-BF16.gguf
      --ctx-size 131072
      -ngl 99
      --main-gpu 0
      --split-mode none
      --fit off
      --flash-attn on
      --temp 0.2 --top-k 80 --repeat-penalty 1.05
      --jinja
      --parallel 1
      --batch-size 4096
      --ubatch-size 2048
```

```sh
  Qwen3.8-9B-Distill:
    ttl: 300
    cmd: >
      /usr/local/bin/llama-server
      --port ${PORT}
      --model /models/qwen3.8-9B-Distill/Qwen3.8-9B-BF16.gguf
      --ctx-size 131072
      -ngl 99
      --main-gpu 0
      --split-mode none
      --fit off
      --flash-attn on
      --temp 0.6 --top-p 0.95 --top-k 20
      --jinja
      --parallel 1
      --batch-size 4096
      --ubatch-size 2048
```

</details>

## Intro

I've recently started looking into the best options for a simple task model I could run on my secondary GPU (along with an embedding model and some TTS). I basically hadn't considered models smaller than 27b since Gemma4-12b dropped. I found it lackluster in tool calling and sys prompt adherence in my harness and ended up scrapping it. I heard good things about Spark X2.5 4B, so I figured I should check in on the state of small models. Maybe some of the recently released models could suffice for title generation, media recommendations, document editing, calorie tracking, light chat, and any other tiny fast tasks.

The models I found with some good anecdotal buzz were Spark-X2.5-1.7B, MiniCPM5-2B, LFM2.5-2.6B, Nanbeige4.2-3B, Spark-X2.5-4B, Ling-3.0-tiny, and LFM2.5-8B-A1B. I also added the quirky Qwen3.8-9B that is actually Qwen3.5-9B distilled from Qwen3.8 2.4T A95B. It is a lot bigger than the others but seemed like a novel, worthwhile addition. I pulled BF16 GGUFs for each to load in Llama.cpp for some benchmarks. The only exception was Spark-X2.5, that wasn't in Llama.cpp main at the time of benchmarking so I ran that in vLLM. I didn't bother with quantization on the models or KV cache. They were all small enough to fit in VRAM and I figured I would isolate my top 3 before determining the best quant.

## Speed

Model speed isn't super important at this size. Every model will prefill faster than any task requires, and decode speed is in 100-300tok/s range. Regardless I figured I should take a look:

| Model | Decode (tok/s) | Prefill (tok/s) |
|---|---|---|
| [Spark-X2.5-1.7B (1.7B)](https://huggingface.co/XHToken/Spark-X2.5-1.7B) | ~295 | ~75k |
| [MiniCPM5-2B (2B)](https://huggingface.co/openbmb/MiniCPM5-2B) | ~260 | ~31k |
| [LFM2.5-2.6B (2.6B)](https://huggingface.co/LiquidAI/LFM2.5-2.6B) | ~231 | ~36k |
| [Nanbeige4.2-3B (3B)](https://huggingface.co/Nanbeige/Nanbeige4.2-3B) | ~103 | ~12k |
| [Spark-X2.5-4B (4B)](https://huggingface.co/XHToken/Spark-X2.5-4B) | ~148 | ~35k |
| [Ling-3.0-tiny (7.9B MoE, 1.3B active)](https://huggingface.co/inclusionAI/Ling-3.0-tiny) | ~285 | ~8.7k |
| [LFM2.5-8B-A1B (8B MoE, 1B active)](https://huggingface.co/LiquidAI/LFM2.5-8B-A1B) | ~303 | ~26k |
| [Qwen3.8-9B-Distill (9B)](https://huggingface.co/empero-ai/Qwen3.8-9B-Distill) | ~90 | ~12k |

<details>
<summary><strong>📊 Speed Test Config</strong></summary>

```sh
vllm bench serve \
  --backend openai \
  --base-url http://127.0.0.1:8500 \
  --endpoint /v1/completions \
  --model {model} \
  --tokenizer {tokenizer} \
  --trust-remote-code \
  --dataset-name random \
  --random-input-len 8192 \
  --random-output-len 128 \
  --random-prefix-len 0 \
  --num-prompts 20 \
  --max-concurrency 1 \
  --ignore-eos \
  --percentile-metrics ttft,tpot,itl
```
</details>

The Spark-X2.5 models once again were on vLLM, so their numbers arent perfectly comparable to the others. Taken with a grain of salt, speed standouts with the upcoming results in consideration were Spark-X2.5-4B with its great prefill and Ling-3.0-tiny with its great decode. 

## Traditional Benchmarks
*note these are not comparable to leaderboards - different sample size, different Arena Hard judge.*

### BFCL v4 - Tool Calling

**Details:** 50 samples, 6 test subsets → 300 samples total

![BFCL v4 — Overall Accuracy](/blog/small-llm-shootout/bfcl_v4_overall.png)

<details>
<summary><strong>📊 Expand Data Tables</strong></summary>

#### Overall Accuracy

| Model | Score | Samples | Latency (s) |
|---|---|---|---|
| Spark-X2.5-1.7B (1.7B) | 61.0% | 300 | 5.09 |
| MiniCPM5-2B (2B) | 81.0% | 300 | 4.99 |
| LFM2.5-2.6B (2.6B) | 80.3% | 300 | 1.93 |
| Nanbeige4.2-3B (3B) | 83.0% | 300 | 3.78 |
| Spark-X2.5-4B (4B) | 82.3% | 300 | 4.68 |
| Ling-3.0-tiny (7.9B MoE, 1.3B active) | 77.7% | 300 | 2.42 |
| LFM2.5-8B-A1B (8B MoE, 1B active) | 83.7% | 300 | 2.89 |
| Qwen3.8-9B-Distill (9B) | 83.0% | 300 | 2.65 |

#### By Subset

![BFCL v4 — By Subset](/blog/small-llm-shootout/bfcl_v4_subsets.png)

| Subset | Spark-X2.5-1.7B | MiniCPM5-2B | LFM2.5-2.6B | Nanbeige4.2-3B | Spark-X2.5-4B | Ling-3.0-tiny | LFM2.5-8B-A1B | Qwen3.8-9B-Distill |
|---|---|---|---|---|---|---|---|---|
| Simple Python | 58.0% | 96.0% | 96.0% | 96.0% | 96.0% | 94.0% | 96.0% | 96.0% |
| Multiple | 84.0% | 98.0% | 94.0% | 88.0% | 90.0% | 92.0% | 94.0% | 96.0% |
| Parallel | 64.0% | 88.0% | 82.0% | 90.0% | 90.0% | 88.0% | 86.0% | 86.0% |
| Multi-Turn Base | 24.0% | 48.0% | 50.0% | 70.0% | 58.0% | 44.0% | 50.0% | 56.0% |
| Live Multiple | 50.0% | 76.0% | 82.0% | 78.0% | 74.0% | 74.0% | 86.0% | 86.0% |
| Irrelevance | 86.0% | 80.0% | 78.0% | 76.0% | 86.0% | 74.0% | 90.0% | 78.0% |

</details>

### IFEval - Instruction-Following

**Details:** 250 samples

![IFEval — Instruction Following](/blog/small-llm-shootout/ifeval.png)

<details>
<summary><strong>📊 Expand Data Tables</strong></summary>

| Model | Prompt-level (strict) | Instruction-level (strict) | Prompt-level (loose) | Instruction-level (loose) | Samples |
|---|---|---|---|---|---|
| Spark-X2.5-1.7B (1.7B) | 71.6% | 82.1% | 75.2% | 84.5% | 250 |
| MiniCPM5-2B (2B) | 86.0% | 90.3% | 88.0% | 92.2% | 250 |
| LFM2.5-2.6B (2.6B) | 93.2% | 95.5% | 94.0% | 96.1% | 250 |
| Nanbeige4.2-3B (3B) | 78.0% | 83.6% | 82.4% | 87.1% | 250 |
| Spark-X2.5-4B (4B) | 75.2% | 83.9% | 78.8% | 86.3% | 250 |
| Ling-3.0-tiny (7.9B MoE, 1.3B active) | 75.6% | 84.8% | 76.4% | 85.3% | 250 |
| LFM2.5-8B-A1B (8B MoE, 1B active) | 90.8% | 94.1% | 91.6% | 94.7% | 250 |
| Qwen3.8-9B-Distill (9B) | 84.4% | 89.1% | 86.4% | 90.4% | 250 |

</details>

### MMLU-Pro - Reasoning

**Details:** 30 samples, 14 categories → 420 samples total

![MMLU-Pro — Overall Accuracy](/blog/small-llm-shootout/mmlu_pro_overall.png)

<details>
<summary><strong>📊 Expand Data Tables</strong></summary>

#### Overall Scores

| Model | Score | Samples | Latency (s) |
|---|---|---|---|
| Spark-X2.5-1.7B (1.7B) | 47.4% | 420 | 11.50 |
| MiniCPM5-2B (2B) | 58.8% | 420 | 4.86 |
| LFM2.5-2.6B (2.6B) | 61.2% | 420 | 13.67 |
| Nanbeige4.2-3B (3B) | 69.8% | 420 | 9.70 |
| Spark-X2.5-4B (4B) | 64.8% | 420 | 10.56 |
| Ling-3.0-tiny (7.9B MoE, 1.3B active) | 55.7% | 420 | 21.25 |
| LFM2.5-8B-A1B (8B MoE, 1B active) | 60.2% | 420 | 10.35 |
| Qwen3.8-9B-Distill (9B) | 71.4% | 420 | 9.66 |

#### By Category

![MMLU-Pro — By Category](/blog/small-llm-shootout/mmlu_pro_categories.png)

| Category | Spark-X2.5-1.7B | MiniCPM5-2B | LFM2.5-2.6B | Nanbeige4.2-3B | Spark-X2.5-4B | Ling-3.0-tiny | LFM2.5-8B-A1B | Qwen3.8-9B-Distill |
|---|---|---|---|---|---|---|---|---|
| Computer Science | 70.0% | 76.7% | 76.7% | 86.7% | 83.3% | 56.7% | 70.0% | 80.0% |
| Math | 70.0% | 80.0% | 90.0% | 80.0% | 90.0% | 80.0% | 80.0% | 96.7% |
| Chemistry | 73.3% | 80.0% | 80.0% | 80.0% | 86.7% | 70.0% | 80.0% | 90.0% |
| Engineering | 40.0% | 66.7% | 60.0% | 70.0% | 70.0% | 46.7% | 50.0% | 86.7% |
| Law | 36.7% | 26.7% | 23.3% | 43.3% | 33.3% | 26.7% | 20.0% | 43.3% |
| Biology | 60.0% | 76.7% | 83.3% | 83.3% | 86.7% | 76.7% | 83.3% | 90.0% |
| Health | 33.3% | 50.0% | 56.7% | 60.0% | 50.0% | 60.0% | 60.0% | 73.3% |
| Physics | 50.0% | 73.3% | 80.0% | 90.0% | 86.7% | 70.0% | 83.3% | 83.3% |
| Business | 56.7% | 63.3% | 76.7% | 66.7% | 70.0% | 66.7% | 60.0% | 76.7% |
| Philosophy | 30.0% | 53.3% | 50.0% | 60.0% | 50.0% | 33.3% | 40.0% | 50.0% |
| Economics | 43.3% | 46.7% | 50.0% | 73.3% | 73.3% | 56.7% | 60.0% | 76.7% |
| Other | 33.3% | 30.0% | 33.3% | 56.7% | 46.7% | 43.3% | 40.0% | 46.7% |
| Psychology | 43.3% | 53.3% | 50.0% | 76.7% | 46.7% | 60.0% | 66.7% | 66.7% |
| History | 23.3% | 46.7% | 46.7% | 50.0% | 33.3% | 33.3% | 50.0% | 40.0% |

</details>

### Arena-Hard - Reasoning

**Details:** 75 samples, run with `--repeat-penalty 1.1 --min-p 0.05`, judged by Deepseek V4 Flash 0731

![Arena-Hard — Win Rate](/blog/small-llm-shootout/arena_hard.png)

<details>
<summary><strong>📊 Expand Data Tables</strong></summary>

| Model | Win Rate | Samples | Avg Output Tokens |
|---|---|---|---|
| Spark-X2.5-1.7B (1.7B) | 24.1% | 75 | 29,398.1 |
| MiniCPM5-2B (2B) | 33.9% | 75 | 30,553.4 |
| LFM2.5-2.6B (2.6B) | 41.9% | 75 | 6,640.0 |
| Nanbeige4.2-3B (3B) | 81.2% | 75 | 6,071.7 |
| Spark-X2.5-4B (4B) | 57.8% | 75 | 17,259.1 |
| Ling-3.0-tiny (7.9B MoE, 1.3B active) | 48.7% | 75 | 19,133.7 |
| LFM2.5-8B-A1B (8B MoE, 1B active) | 40.5% | 75 | 4,336.4 |
| Qwen3.8-9B-Distill (9B) | 68.5% | 75 | 6,379.0 |

</details>

### HumanEval+ & MBPP+ - Coding

**Details:** One pass each
- **HumanEval+:** 164 problems
- **MBPP+:** 378 problems

![HumanEval+ — pass@1 (164 problems)](/blog/small-llm-shootout/humaneval_plus.png)

![MBPP+ — pass@1 (378 problems)](/blog/small-llm-shootout/mbpp_plus.png)

<details>
<summary><strong>📊 Expand Data Tables</strong></summary>

#### Combined Comparison

| Model | HumanEval+ pass@1 | MBPP+ pass@1 |
|---|---|---|
| Spark-X2.5-1.7B (1.7B) | 42.1% | 64.5% |
| MiniCPM5-2B (2B) | 81.1% | 83.9% |
| LFM2.5-2.6B (2.6B) | 88.4% | 81.5% |
| Nanbeige4.2-3B (3B) | 75.0% | 85.5% |
| Spark-X2.5-4B (4B) | 74.4% | 83.1% |
| Ling-3.0-tiny (7.9B MoE, 1.3B active) | 79.3% | 84.1% |
| LFM2.5-8B-A1B (8B MoE, 1B active) | 76.2% | 85.5% |
| Qwen3.8-9B-Distill (9B) | 81.1% | 85.2% |

#### HumanEval+ — pass@1 (164 problems)

| Model | pass@1 | Samples | Latency (s) | Avg Output Tokens | Output (tok/s) |
|---|---|---|---|---|---|
| Spark-X2.5-1.7B (1.7B) | 42.1% | 164 | 2.86 | 499.7 | 174.8 |
| MiniCPM5-2B (2B) | 81.1% | 164 | 2.18 | 421.5 | 192.9 |
| LFM2.5-2.6B (2.6B) | 88.4% | 164 | 8.39 | 1,582.5 | 188.6 |
| Nanbeige4.2-3B (3B) | 75.0% | 164 | 6.88 | 480.2 | 69.8 |
| Spark-X2.5-4B (4B) | 74.4% | 164 | 1.88 | 266.6 | 141.6 |
| Ling-3.0-tiny (7.9B MoE, 1.3B active) | 79.3% | 164 | 2.72 | 272.0 | 100.0 |
| LFM2.5-8B-A1B (8B MoE, 1B active) | 76.2% | 164 | 8.55 | 1,775.6 | 207.8 |
| Qwen3.8-9B-Distill (9B) | 81.1% | 164 | 2.76 | 213.6 | 77.2 |

#### MBPP+ — pass@1 (378 problems)

| Model | pass@1 | Samples | Latency (s) | Avg Output Tokens | Output (tok/s) |
|---|---|---|---|---|---|
| Spark-X2.5-1.7B (1.7B) | 64.5% | 378 | 3.67 | 950.9 | 258.9 |
| MiniCPM5-2B (2B) | 83.9% | 378 | 1.89 | 358.0 | 189.1 |
| LFM2.5-2.6B (2.6B) | 81.5% | 378 | 14.16 | 2,605.5 | 184.0 |
| Nanbeige4.2-3B (3B) | 85.5% | 378 | 11.32 | 842.6 | 74.5 |
| Spark-X2.5-4B (4B) | 83.1% | 378 | 8.02 | 1,085.3 | 135.3 |
| Ling-3.0-tiny (7.9B MoE, 1.3B active) | 84.1% | 378 | 5.04 | 394.8 | 78.3 |
| LFM2.5-8B-A1B (8B MoE, 1B active) | 85.5% | 378 | 9.38 | 1,923.8 | 205.0 |
| Qwen3.8-9B-Distill (9B) | 85.2% | 378 | 4.04 | 310.2 | 76.7 |

</details>

## Unstructured / Personal Tests

### Open-WebUI Chat - Search, Reasoning, Function Calling

I primarily use Open-Webui for my LLM chat needs. This test is set up to see how well the model fares in my harness. Can it obey the system prompt and follow the user prompt? Can it properly assess available tools, format the calls, and handle errors? 

1. Can you find a few recently released unified memory systems with 128gb+ ram and compare their prices/availability/pros and cons?
2. Can you format that information into a single page pdf so i can share it?

I'm expecting to see information about Nvidia RTX/DGX spark, existing and upcoming M# Ultra Mac Studios, and some of the various Ryzen AI Max 395 mini pcs. I'm expecting to see MSRP, but would love to see a model identify how much prices have increased. I'm also expecting to see pros and cons discussing availability, memory size, memory bandwidth, and compute. Lastly I'm expecting these models to be able to find and call the PDF creation tools present in the harness easily.

#### Results

{{< model-report-tabs >}}

Only Spark-X2.5-4B & Nanbeige4.2-3B respected my sys prompt's instructions to specify how many search results to request (N=1-3). Ling has the objectively best result I think, but the sacrifice is hitting ~80 sources for what is a really simple question. The models I'm most impressed with here are Spark-X2.5-4B, Nanbeige4.2-3B, and Ling-3.0-tiny. Nanbeige being the only model that TECHNICALLY followed ALL provided instructions in sys prompt and user prompt. This kinda lines up with the benchmark results, Nanbeige really eatin.

### Pelican on a Bicycle

Let's yet again end on the classic silly "pelican on a bicycle" prompt.

> Generate an SVG of a pelican riding a bicycle

{{< model-report-tabs file="small_llm_shootout/pelican_results.json" kind="svg" uid="pelicans" >}}

Obviously none of these are 'good' but at least LFM2.5-2.6B, Nanbeige4.2-3B, Ling-3.0-tiny, and Qwen3.8-9B-Distill generated a form that can extremely abstractly be determined to contain a bird and some form of 2 wheeled vehicle. I would personally make the claim the Qwen3.8-9B-Distill's was the best. The bird is most identifiably a pelican with the thick bill and the bicycle is pretty interpretable. Runner up would be Nanbeige4.2-3B. The spokes were impressive, but the bird is jumbled and the single triangle bike frame is hilarious. I'll let you draw your own conclusions though.

{{< verdict >}}
<p class="verdict-lead">Conclusion</p>

- I'm honestly most impressed with Nanbeige4.2-3B. It didn't score near the top on IFEval and was gapped by LFM2.5-2.6B in Humaneval+, but in every other benchmark (even pelican) it landed near the top or far above others. The most important benchmark win was the notable dominance in Arena Hard, and with the shortest outputs. And when it came to my real world use case it did a great job. It obeyed all instructions, found solid information (even though it could have been more diverse), and generated the report (even though theres a formatting/color issue in the 2nd table). 
- LFM2.5-8B-A1B shocked me with the BFCL dominance, but it fell apart in my harness
- LFM2.5-2.6B took IFEval and HumanEval+ notably, but it simply couldn't generate a functional PDF output, and didn't fare well against arena hard. It may be worth a second look/investigation.

My next step will be to grab the Q8/FP8 for Nanbeige4.2-3B, Spark-X2.5-4B, and Ling-3.0-tiny to see which fares best at the quant I'd run them at.

{{< /verdict >}}

