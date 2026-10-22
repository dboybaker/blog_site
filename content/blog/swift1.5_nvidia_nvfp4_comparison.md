---
title: "Q3.8FN - Swift1.5 vs NVIDIA NVFP4"
date: 2026-10-22T12:00:00Z
publishDate: 2026-10-22T12:00:00Z
draft: false
tags: ["llm", "vLLM", "quantization", "nvfp4", "benchmark", "qwen"]
summary: "Qwen3.8-Flash-Next: UkisAI's own NVFP4 of their token-efficiency finetune vs NVIDIA's. A test to measure the difference, and confirm Swift's tool-calling capabilities."
---

{{< ctx-bar >}}
<span><strong>Tested in this article: </strong> nvidia/Qwen3.8-Flash-Next-NVFP4, ukisai/Swift-1.5-Qwen3.8-Flash-Next-NVFP4 (PLE quantized to FP8)  </span>

<span><strong>Hardware:</strong> RTX 6000 Blackwell · 96 GB VRAM, 96 GB DDR4  </span>
<span><strong>OS:</strong> Debian 13  </span>
<span><strong>Engine:</strong> vLLM  </span>
<span><strong>Benchmarks:</strong> BFCL v4, MMLU-Pro, IFEval, HumanEval+, MBPP+, Arena-Hard, Word500, (+ harness tests)</span>
{{< /ctx-bar >}}

<details>
<summary><strong>📊 Expand vLLM Config</strong></summary>

```yaml
  qwen3.8-flash-next-nvfp4:
    ttl: 10000
    healthCheckTimeout: 900
    env:
      - VLLM_PLE_CPU_OFFLOAD=1
      - MAX_JOBS=6
    cmd: >
      vllm serve /models/qwen3.8-flash-next/nvfp4
      --served-model-name qwen3.8-flash-next-nvfp4
      --port ${PORT}
      --quantization modelopt
      --trust-remote-code
      --max-model-len 262144
      --max-num-seqs 4
      --max-num-batched-tokens 8192
      --gpu-memory-utilization 0.95
      --enable-prefix-caching
      --async-scheduling
      --no-enable-flashinfer-autotune
      --reasoning-parser qwen3
      --enable-auto-tool-choice
      --tool-call-parser qwen3_coder
      --speculative-config '{"method":"mtp","num_speculative_tokens":2}'
```

```yaml
  swift1.5-flash-next-vllm:
    ttl: 600
    healthCheckTimeout: 1200
    env:
      - VLLM_PLE_CPU_OFFLOAD=1
      - MAX_JOBS=6
    cmd: >
      vllm serve /models/qwen3.8-flash-next/swift-1.5-fp8ple
      --served-model-name swift1.5-flash-next-vllm
      --port ${PORT}
      --max-model-len 262144
      --max-num-seqs 4
      --max-num-batched-tokens 8192
      --gpu-memory-utilization 0.95
      --enable-prefix-caching
      --reasoning-parser qwen3
      --enable-auto-tool-choice
      --tool-call-parser qwen3_xml
      --trust-remote-code
      --speculative-config '{"method":"mtp","num_speculative_tokens":2}'
```

</details>

## Intro

In [my last entry](/blog/q3.8fn_engine_comparison/) I found Ninfer6000 - ran with a Swift1.5-derived checkpoint - kept printing tool calls into the transcript instead of dispatching them. This happened during my in-harness benchmarks and repeatedly while I was trying to use it for real work. I ended that post unsure whether to blame the engine, the Ninfer conversion, or Swift1.5 itself.

So this time I took the engine out of the question to isolate the variable. Both models on vLLM. Same quantization recipe, same sampling parameters. The only differences were the recommended `--tool-call-parser` plus `--quantization modelopt` and `--async-scheduling` on NVIDIA.


- **[nvidia/Qwen3.8-Flash-Next-NVFP4](https://huggingface.co/nvidia/Qwen3.8-Flash-Next-NVFP4)** - NVIDIA's official post-quantization of the stock Qwen3.8-Flash-Next.
- **[ukisai/Swift-1.5-Qwen3.8-Flash-Next-NVFP4](https://huggingface.co/ukisai/Swift-1.5-Qwen3.8-Flash-Next-NVFP4)** - UkisAI's reasoning-efficiency derivative of the same base. The only weight change I made is the PLE embedding, quantized to FP8 to match.

The intent here is to determine if Swift1.5 is the cause of the tool calling issues or not. I predict it was Ninfer6000 or its conversion, not the Swift1.5 tune. It will also be a prime opportunity to compare these models and determine if Swift is worth running over NVIDIA's as my daily driver.

As mentioned, Swift's benefits lie in reasoning efficiency. UkisAI's card claims the finetune uses **63.4% fewer thinking tokens**(median) for a **1.8x wall-clock speedup** at **<1% accuracy loss** versus the BF16 base.

## Speed

### Prefill/Decode Sweep

Same synthetic speed test as the last entry, single stream, prompt size from 1k to the edge of max ctx.

{{< chart type="line" height="320" >}}
{
  "labels": ["1k","4k","16k","32k","64k","128k","200k","260k"],
  "datasets": [
    {"label":"NVIDIA NVFP4","data":[141.8,168.6,139.4,163.1,135.4,146.3,156.9,142.6],"borderColor":"#5cd6e0","backgroundColor":"rgba(92,214,224,0.10)","tension":0.25,"pointRadius":4},
    {"label":"Swift1.5 NVFP4","data":[158.6,154.1,160.6,154.7,179.0,160.5,159.2,149.2],"borderColor":"#ff8a5c","backgroundColor":"rgba(255,138,92,0.10)","tension":0.25,"pointRadius":4}
  ],
  "scales": {
    "y": {"min":120,"max":190,"title":{"display":true,"text":"decode tok/s","color":"#9898a8"},"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}},
    "x": {"title":{"display":true,"text":"prompt tokens","color":"#9898a8"},"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}}
  }
}
{{< /chart >}}

{{< chart type="line" height="300" >}}
{
  "labels": ["1k","4k","16k","32k","64k","128k","200k","260k"],
  "datasets": [
    {"label":"NVIDIA NVFP4","data":[0.16,0.27,0.97,1.93,3.89,7.93,12.87,17.08],"borderColor":"#5cd6e0","backgroundColor":"rgba(92,214,224,0.10)","tension":0.25,"pointRadius":4},
    {"label":"Swift1.5 NVFP4","data":[0.16,0.27,0.94,1.88,3.78,7.75,12.49,16.62],"borderColor":"#ff8a5c","backgroundColor":"rgba(255,138,92,0.10)","tension":0.25,"pointRadius":4}
  ],
  "scales": {
    "y": {"title":{"display":true,"text":"time to first token (s)","color":"#9898a8"},"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}},
    "x": {"title":{"display":true,"text":"prompt tokens","color":"#9898a8"},"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}}
  }
}
{{< /chart >}}

<details>
<summary><strong>📊 Expand Speed Table</strong></summary>

Each cell is *prefill tok/s · time-to-first-token · decode tok/s* at that prompt length:

| Prompt | NVIDIA NVFP4 | Swift1.5 NVFP4 |
|---|---|---|
| 1,000 | 7,087 · 0.16 s · 141.8 | 7,182 · 0.16 s · 158.6 |
| 4,000 | 15,122 · 0.27 s · 168.6 | 14,937 · 0.27 s · 154.1 |
| 16,000 | 16,263 · 0.97 s · 139.4 | 16,539 · 0.94 s · 160.6 |
| 32,000 | 16,238 · 1.93 s · 163.1 | 16,486 · 1.88 s · 154.7 |
| 64,000 | 16,075 · 3.89 s · 135.4 | 16,368 · 3.78 s · 179.0 |
| 128,000 | 15,780 · 7.93 s · 146.3 | 15,975 · 7.75 s · 160.5 |
| 200,000 | 15,199 · 12.87 s · 156.9 | 15,507 · 12.49 s · 159.2 |
| 260,000 | 14,896 · 17.08 s · 142.6 | 15,131 · 16.62 s · 149.2 |
| **mean (16k-260k)** | **15,742** · **7.45 s** · **147.3** | **16,001** · **7.24 s** · **160.5** |

</details>

**Prefill is the same.** Averaged from 16k up, 15,742 vs 16,001 tok/s - 1.6% apart. Nothing to report.

**Decode is a bit noisy.** Swift sits above NVIDIA on the 16k-260k mean, 160.5 vs 147.3 tok/s (+9.0%), and on the median too (159.9 vs 144.5). Across all eight points the gap is +6.8%. NVIDIA swings up to 29 tok/s between adjacent prompt sizes and Swift up to 24. NVIDIA takes 4k and 32k, Swift takes everywhere else, by 32% at 64k. With swings that big inside each line, a single-digit gap between them doesn't say much. I read the decode gap as noise. The results from the actual benchmarks would be more reliable for comparison.

### In-Benchmark Speed

The sweep is synthetic and single-stream. The scored suites are the opposite: concurrency, reasoning traces, and a tool-calling parser.

**Effective throughput.** These sit far below the sweep's ~150 tok/s because these runs are concurrent and the models are thinking, and Arena-Hard in particular is long-form reasoning at 64k budget.

{{< chart type="bar" height="340" >}}
{
  "labels": ["BFCL v4","IFEval","MMLU-Pro","HumanEval+","MBPP+","Arena-Hard"],
  "datasets": [
    {"label":"NVIDIA NVFP4","data":[86.3,47.6,117.1,135.1,126.7,42.5],"backgroundColor":"rgba(92,214,224,0.6)","borderColor":"#5cd6e0","borderWidth":2},
    {"label":"Swift1.5 NVFP4","data":[90.4,51.1,123.3,141.3,132.4,47.6],"backgroundColor":"rgba(255,138,92,0.6)","borderColor":"#ff8a5c","borderWidth":2}
  ],
  "scales": {
    "y": {"title":{"display":true,"text":"mean output tok/s per request","color":"#9898a8"},"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}},
    "x": {"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}}
  }
}
{{< /chart >}}

<details>
<summary><strong>📊 Expand Throughput Table</strong></summary>

| Suite | Requests | NVIDIA tok/s | Swift tok/s |
|---|---|---|---|
| BFCL v4 | 1,031 (300 tasks) | 86.3 | **90.4** |
| IFEval | 250 | 47.6 | **51.1** |
| MMLU-Pro | 420 | 117.1 | **123.3** |
| HumanEval+ | 164 | 135.1 | **141.3** |
| MBPP+ | 378 | 126.7 | **132.4** |
| Arena-Hard | 75 | 42.5 | **47.6** |

</details>

Swift reads higher in all six, by 4.5% to 12%. That consistency without `--async-scheduling` is noteworthy - which if anything should have flattered NVIDIA's side of this table.

One caveat. The single-stream sweep had these two within a few percent of each other, so this is a wider gap than raw speed explains. Concurrency, prefix caching and thinking traces all get mixed into a number like this, and a model that writes less gives the scheduler less to do. Swift got through the work faster.

**Latency.** Per-request wall time, which is what a person actually feels:

| Suite | Requests | NVIDIA mean | Swift mean | Δ | NVIDIA p50 → p90 | Swift p50 → p90 |
|---|---|---|---|---|---|---|
| BFCL v4 | 1,031 (300 tasks) | 2.30 s | **1.95 s** | -15.2% | 1.39 → 4.19 s | **1.32 → 3.76 s** |
| IFEval | 250 | 8.15 s | **7.27 s** | -10.8% | 2.67 → 9.64 s | **2.43 → 9.25 s** |
| MMLU-Pro | 420 | 9.09 s | **7.80 s** | -14.2% | 6.18 → 16.56 s | **5.56 → 14.04 s** |
| HumanEval+ | 164 | 1.76 s | **1.52 s** | -13.6% | 1.45 → 2.40 s | **1.37 → 2.29 s** |
| MBPP+ | 378 | 1.66 s | **1.55 s** | -6.6% | 0.97 → 3.00 s | **0.93 → 2.41 s** |
| Arena-Hard | 75 | 316.84 s | **167.92 s** | **-47.0%** | 271.03 → 503.31 s | **139.53 → 351.36 s** |

Swift also wins every row on latency, but latency is a function of how many tokens the model output. This is really the next section in disguise.

### Output Token Side-by-side

This is where the two diverge. Same prompts, same suites - just count the output tokens:

{{< chart type="bar" height="360" >}}
{
  "labels": ["Word500","Arena-Hard","MMLU-Pro","BFCL v4","IFEval","MBPP+","HumanEval+"],
  "datasets": [
    {"label":"NVIDIA NVFP4","data":[971.6,1010.2,446.9,204.5,97.0,79.7,39.1],"backgroundColor":"rgba(92,214,224,0.6)","borderColor":"#5cd6e0","borderWidth":2},
    {"label":"Swift1.5 NVFP4","data":[884.8,599.8,404.0,171.5,92.9,77.6,35.1],"backgroundColor":"rgba(255,138,92,0.6)","borderColor":"#ff8a5c","borderWidth":2}
  ],
  "scales": {
    "y": {"title":{"display":true,"text":"generated tokens (thousands)","color":"#9898a8"},"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}},
    "x": {"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}}
  }
}
{{< /chart >}}

| Suite | NVIDIA out-tok | Swift out-tok | Δ |
|---|---|---|---|
| Arena-Hard (75) | 1,010,231 | 599,830 | **-40.6%** |
| BFCL v4 (300) | 204,543 | 171,486 | -16.2% |
| MMLU-Pro (420) | 446,911 | 404,014 | -9.6% |
| Word500 (60) | 971,576 | 884,770 | -8.9% |
| IFEval (250) | 97,012 | 92,872 | -4.3% |
| MBPP+ (378) | 79,684 | 77,647 | -2.6% |
| HumanEval+ (164) | 39,082 | 35,121 | -10.1% |
| **all seven suites** | **2,849,039** | **2,265,740** | **-20.5%** |

Add the per-request times up and the 6 scored tests run for **32,907 request-seconds on NVIDIA and 20,421 for Swift.** 38% less wall time for  similar result. Arena-Hard dominates that total though. Take it out and it's 14.4%.

The pattern is reasonable: the savings are smallest where there isn't much to think about and biggest where the model is expected to do notable reasoning (Arena-Hard -40.6%).

## Traditional Benchmarks
*note these are not comparable to leaderboards - different sample size, different Arena Hard judge.*

I ran the usual suspects hoping they'd tell me something. They didn't. One pass through each at temp 1.0 / top_p 0.95:

{{< chart type="bar" height="360" >}}
{
  "labels": ["BFCL v4","IFEval","MMLU-Pro","HumanEval+","MBPP+","Arena-Hard"],
  "datasets": [
    {"label":"NVIDIA NVFP4","data":[78.0,81.2,83.1,95.1,95.8,99.4],"backgroundColor":"rgba(92,214,224,0.6)","borderColor":"#5cd6e0","borderWidth":2},
    {"label":"Swift1.5 NVFP4","data":[78.7,84.8,84.8,93.9,95.8,99.4],"backgroundColor":"rgba(255,138,92,0.6)","borderColor":"#ff8a5c","borderWidth":2}
  ],
  "scales": {
    "y": {"min":60,"max":100,"title":{"display":true,"text":"accuracy / winrate (%)","color":"#9898a8"},"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}},
    "x": {"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}}
  }
}
{{< /chart >}}

| Benchmark | Samples | NVIDIA NVFP4 | Swift1.5 NVFP4 | Δ |
|---|---|---|---|---|
| Tool calling (BFCL v4) | 300 | 78.00 | **78.67** | +0.67 |
| Instruction following (IFEval, prompt-strict) | 250 | 81.20 | **84.80** | +3.60 |
| Knowledge (MMLU-Pro) | 420 | 83.10 | **84.76** | +1.66 |
| Code (HumanEval+) | 164 | **95.12** | 93.90 | -1.22 |
| Code (MBPP+) | 378 | 95.77 | 95.77 | 0.00 |
| Long-form (Arena-Hard, judge winrate) | 75 | 99.36 | 99.37 | +0.01 |
| **mean of the six** | - | 88.76 | **89.55** | **+0.79** |
| Reasoning game (Word500) | 60 | **91.67** | 75.00 | **-16.67** |

Clearly a tie. Nonsignificant variance in accuracy across the lot. I checked these properly rather than eyeballing the deltas, and none of them are big enough to differentiate. With IFEval there was a directionally consistent pattern. Still probably noise but fewer tokens spent, more instructions obeyed could signal some value.

### Arena-Hard

**Details:** 75 prompts judged, single pass, temp 1.0, `max_tokens: 64000`, judge `deepseek/deepseek-v4-flash-0731`.

The winrate is irrelevant, saturated and separated by nothing, but what it did produce is the cleanest reasoning-efficiency number in the entry.

{{< chart type="bar" height="340" >}}
{
  "labels": ["min","median","mean","p75","p90","p99","max"],
  "datasets": [
    {"label":"NVIDIA NVFP4","data":[291,9549,13470,18892,29086,54574,62661],"backgroundColor":"rgba(92,214,224,0.6)","borderColor":"#5cd6e0","borderWidth":2},
    {"label":"Swift1.5 NVFP4","data":[259,4879,7998,13128,18917,26779,26819],"backgroundColor":"rgba(255,138,92,0.6)","borderColor":"#ff8a5c","borderWidth":2}
  ],
  "scales": {
    "y": {"title":{"display":true,"text":"output tokens per answer","color":"#9898a8"},"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}},
    "x": {"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}}
  }
}
{{< /chart >}}

| Metric | NVIDIA NVFP4 | Swift1.5 NVFP4 |
|---|---|---|
| Judge winrate | 99.36% | 99.37% |
| Median answer | 9,549 tok | **4,879 tok** |
| Mean answer | 13,470 tok | **7,998 tok** |
| p90 answer | 29,086 tok | **18,917 tok** |
| Longest answer | **62,661 tok** | 26,819 tok |
| Total output | 1,010,231 tok | **599,830 tok** |
| Mean latency | 316.8 s | **167.9 s** |
| p90 latency | 503.3 s | **351.4 s** |

These results are the strongest evidence I found for the Swift ideal of fewer tokens for the same grade. It carifies the observation of [last entry's Arena-Hard result](/blog/q3.8fn_engine_comparison/), where Swift's brevity looked like it might be buying it a scoring advantage. In reality when no cutoffs happen, brevity doesn't impact the score.

### Word500

Back to [the puzzle benchmark](/blog/word500_benchmark/) - guess the five letter word given only the counts of letters in the right place, wrong place, or nowhere. This test specifically strains models for accuracy and reasoning efficiency. Unlike Arena-Hard, the token reduction did display an effect on how likely the model's guess was to be correct.

**Details:** 6 boards x 10 samples x 2 models = 120 runs, temp 1.0 / top_p 0.95, `max_tokens: 64000`, concurrency 4, loop-abort at 10 consecutive repeats. Three boards (`Smoke`, `Poker`, `Hoard`) each run twice: once as a screenshot, once as text only.

{{< chart type="bar" height="340" >}}
{
  "labels": ["Smoke","Poker","Hoard","Smoke (text)","Poker (text)","Hoard (text)"],
  "datasets": [
    {"label":"NVIDIA NVFP4","data":[100,90,80,100,80,100],"backgroundColor":"rgba(92,214,224,0.6)","borderColor":"#5cd6e0","borderWidth":2},
    {"label":"Swift1.5 NVFP4","data":[70,100,30,100,80,70],"backgroundColor":"rgba(255,138,92,0.6)","borderColor":"#ff8a5c","borderWidth":2}
  ],
  "scales": {
    "y": {"min":0,"max":110,"title":{"display":true,"text":"samples solved (%)","color":"#9898a8"},"ticks":{"color":"#9898a8","stepSize":20},"grid":{"color":"rgba(42,42,58,0.5)"}},
    "x": {"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}}
  }
}
{{< /chart >}}

<details>
<summary><strong>📊 Expand Word500 Tables</strong></summary>

| | NVIDIA NVFP4 | Swift1.5 NVFP4 |
|---|---|---|
| Runs planned / completed | 60 / 60 | 60 / 60 |
| Right output format | 60/60 | 57/60 |
| Solved | 55 | 45 |
| Accuracy | **91.7%** | 75.0% |
| Loop aborts | 0 | **3** |
| Avg tokens per run | 16,193 | **14,746** |
| Median tokens per run | 15,217 | **12,087** |
| Longest single run | 56,436 | 56,580 |

| Board | NVIDIA | Swift | Avg tok (NV → Swift) | Swift loops |
|---|---|---|---|---|
| Smoke (vision) | **10/10** | 7/10 | 9,478 → 12,744 | 1 |
| Poker (vision) | 9/10 | **10/10** | 19,089 → 12,719 | 0 |
| Hoard (vision) | **8/10** | 3/10 | 15,702 → 18,427 | 2 |
| Smoke (text only) | 10/10 | 10/10 | 12,733 → 8,933 | 0 |
| Poker (text only) | 8/10 | 8/10 | 19,825 → 17,047 | 0 |
| Hoard (text only) | **10/10** | 7/10 | 20,331 → 18,608 | 0 |

</details>

**Swift lost the hard board.** `Hoard` with a screenshot went 8/10 to 3/10, and two of Swift's three loop aborts happened there - 18k tokens a try on average, without converging. Strip the screenshot and it goes 10/10 to 7/10. So this isn't only a vision problem; it's the hardest board under *both* presentations.

**It spent fewer tokens while doing worse.** 14,746 average against 16,193 (which actually is only 8.9% less, far smaller gap than expected). While other tests showed the same direction with a bigger margin and no accuracy cost, Word500 showed 9% efficiency gain at the cost of 16.7 points.

**The format rate slipped.** 57 of 60 answers came back in the shape the harness asked for, against 60 of 60. Three malformed answers (loop aborts) over NVIDIA.

This test was what I was most looking forward to between the models as it's the only one that really hits the intersection of what Swift is promising. It shows there is no such thing as a free lunch and Qwen's debated excessive reasoning truly positively impacts outcomes. That isn't to say the gap means Swift isn't worth using, just that use case and accuracy needs on big reasoning tasks must be considered.

## Unstructured / Personal Tests

Curated suites need some personal use cases to anchor them to reality. These are the sorts of in-harness tasks I typically utilize models for.

### Open-WebUI Chat - Search, Reasoning, Function Calling

The same two-turn job from the prior entry:

1. Can you find a few recently released unified memory systems with 128gb+ ram and compare their prices/availability/pros and cons?
2. Can you format that information into a single page pdf so i can share it?

Neither model handled opening/closing tasks perfectly but that's a common behavior. Both searched precisely and found all the devices I would expect. The prices were valid and the result was a single page I could send to communicate the state of the unified memory system market. The difference was the tokens taken to accomplish the task:

| Slot | Task cost |
|---|---|
| NVIDIA NVFP4 | 1.44M tokens |
| Swift1.5 NVFP4 | **436K tokens** |

**3.3x less.** On the harness job, in the direction the finetune advertises.

{{< model-report-tabs file="root:data/blog/swift1.5_nvidia_nvfp4_comparison/unified_memory_results.json" uid="umem" >}}

### Plex recommendation app

A big, messy, directionless 1-shot attempt at a sort of application I may employ the model to create:

> Create a docker compose compatible web app that users can log into with a Plex account to browse popular shows/movies and be given show/movie recommendations based on their watch history and ratings.

These two went in genuinely different directions. NVIDIA built a FastAPI backend with a React frontend, docker-compose, and a test suite. Swift built a Fastify/TypeScript server with a vanilla JS frontend. 
- Neither is a finished product. 
- Both got meaningfully further than I expect from one prompt.
- One quickly decided on a more robust result than the other.

**Initial attempt:**

<table style="width:100%; table-layout:fixed;">
<tr>
<th style="width:50%">NVIDIA NVFP4</th>
<th style="width:50%">Swift1.5 NVFP4</th>
</tr>
<tr>
<td style="width:50%"><img src="figures/plex-nvidia-initial.png" alt="NVIDIA build, first attempt" style="width:100%"></td>
<td style="width:50%"><img src="figures/plex-swift1.5-initial.png" alt="Swift1.5 build, first attempt" style="width:100%"></td>
</tr>
</table>

**After refinement prompts:**

<table style="width:100%; table-layout:fixed;">
<tr>
<th style="width:50%">NVIDIA NVFP4</th>
<th style="width:50%">Swift1.5 NVFP4</th>
</tr>
<tr>
<td style="width:50%"><img src="figures/plex-nvidia-refined.png" alt="NVIDIA build, after refinement" style="width:100%"></td>
<td style="width:50%"><img src="figures/plex-swift1.5-refined.png" alt="Swift1.5 build, after refinement" style="width:100%"></td>
</tr>
</table>

| | NVIDIA NVFP4 | Swift1.5 NVFP4 |
|---|---|---|
| First response | promising layout, no external catalogue used | asked the right question first - Plex only, or TMDB too? |
| Posters | malformed, title text only, no images | rendering, but hidden behind a badly formed UI element |
| Plex login | broken | broken |
| Prompts to fix login | 1 | 1 |
| Prompts to fix posters/UI | 1 | 1 |

After the refinement prompts both were then able to log in, but neither actually pulled watch history and ratings to generate recommendations. Both somewhat faked it at the depth I tested. Both need a lot more refinement but that would be exactly as I expect. A project like this for a model of this size would require a lot more research, guiding, and refining after the initial result. Between these two though I'd pursue Swift's direction if I continued it. I liked that it considered TMDB and the visual experience of the app was in a better direction.

This test makes me think in real world applications, even over long context and deep reasoning, the token reduction is worth it. In the time NVIDIA's finished, Swift's could have finished a refinement pass.

### Designing a server case

This is another real world test that mirrors a project I've been working on. I've designed and built a new case for my LLM rig. Could either of these models 1-shot a 3D representation of the efficient build I brainstormed over weeks? Of course not, but let's see what they output.

> Let's design a case for a server that supports standard ATX motherboard and power supply. It should support an RTX 6000 Blackwell and an Evga 3090 FTW3.
>
> The primary focus should be keeping the case compact and maximizing airflow.
>
> Your output should be a 3D representation of the case for easy viewing.

Both took a long time and neither result is "good". This test is clearly beyond what this model class can do anywhere near 1-shot with no provided structure or ideas. But both actually produced a manipulable 3D model, which is the part I'd written off. Hermes seems to obfuscate its token counts, so I can't put a number on the gap here the way I could on the PDF job.

Both viewers below are the real artifacts, drag to orbit and scroll to zoom. They're three.js, loaded from a CDN, in a self-contained page. Expand to load them.

<details>
<summary><strong>🖥 NVIDIA build - SLIPSTREAM 26, interactive 3D (25.7 L)</strong></summary>

<iframe src="/blog/swift1.5_nvidia_nvfp4_comparison/viewers/nvidia-slipstream26.html" loading="lazy" title="NVIDIA build 3D case viewer" style="width:100%;height:620px;border:1px solid #2a2a3a;border-radius:8px;background:#14161a"></iframe>

[Open full](/blog/swift1.5_nvidia_nvfp4_comparison/viewers/nvidia-slipstream26.html) &#8599;

</details>

<details>
<summary><strong>🖥 Swift1.5 build - STRIDE-2, interactive 3D chassis</strong></summary>

<iframe src="/blog/swift1.5_nvidia_nvfp4_comparison/viewers/swift1.5-stride2.html" loading="lazy" title="Swift1.5 build 3D chassis viewer" style="width:100%;height:960px;border:1px solid #2a2a3a;border-radius:8px;background:#12161d"></iframe>

[Open full](/blog/swift1.5_nvidia_nvfp4_comparison/viewers/swift1.5-stride2.html) &#8599;

</details>

Static renders:

<table style="width:100%; table-layout:fixed;">
<tr>
<th style="width:50%">NVIDIA - SLIPSTREAM 26</th>
<th style="width:50%">Swift1.5 - STRIDE-2</th>
</tr>
<tr>
<td style="width:50%"><img src="figures/case-nvidia-render.png" alt="NVIDIA case render" style="width:100%"></td>
<td style="width:50%"><img src="figures/case-swift1.5-sheet.png" alt="Swift1.5 case sheet" style="width:100%"></td>
</tr>
</table>

<details>
<summary><strong>📐 NVIDIA build's own QA panels</strong></summary>

<table style="width:100%; table-layout:fixed;">
<tr>
<td style="width:50%"><img src="figures/case-nvidia-qa1.png" alt="NVIDIA QA panel 1" style="width:100%"></td>
<td style="width:50%"><img src="figures/case-nvidia-qa3.png" alt="NVIDIA QA panel 3" style="width:100%"></td>
</tr>
</table>

</details>

| | NVIDIA NVFP4 | Swift1.5 NVFP4 |
|---|---|---|
| Concept | stout and wide - lower chamber for PSU/HDDs, upper for motherboard and GPUs | vertical and tall |
| Does the design make sense? | the general idea checks out, but the display doesn't | too tall, fans don't line up but I see the goal |
| Static representation vs Interactive | the two match | Seemingly entirely different static vs interactive |
| Airflow | arrows not laid out properly, fan locations unreadable from the diagram | **arrows in the right spot, everything in the right orientation** |
| GPU spacing | didn't consider the two GPUs choked against each other | also put them in adjacent PCIe slots, and stuck fans on the ends of them |
| Legibility of the deliverable | poor | **much more intelligible than NVIDIA's** |

Both failed the engineering. NVIDIA produced a plausible chassis and delivered it unreadably; Swift produced something plausible but less creative and delivered it more clearly but still imperfect. Swift seemed to output two different designs in static and interactive, but its interactive was at least intelligible. No clear winner here, but a good test nonetheless.

## Conclusion

{{< verdict >}}
<p class="verdict-lead">tl;dr</p>

- **Headline:** Ninfer6000 or its conversion was the cause of the tool-call errors, not Swift's model. I saw no tool calling errors in any in-harness test.
- **Accuracy:** the traditional benchmarks don't separate these two at all. Definitely a win for Swift's claim.
- **Cost:** The Swift efficiency promise is real, and in most tests doesn't cost notable accuracy. Swift wrote 20.5% fewer tokens across seven suites, 40.6% fewer on Arena-Hard for the same judged grade, and about a third of the tokens on the harness PDF job.
- **The exception:** Word500, 91.7 down to 75.0. The reasoning reduction is not always free.

**My pick:** Swift. Through the in-harness tests I could not tell the difference. In fact I liked the Plex app output/behavior better. It is very clearly worth a shot. I will be switching to this as my daily driver for a while and generating a more hands on opinion.

{{< /verdict >}}
