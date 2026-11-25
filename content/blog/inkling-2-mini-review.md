---
title: "Inkling 2 Mini Review"
date: 2026-11-22T00:00:00Z
publishDate: 2026-11-22T00:00:00Z
draft: false
tags: ["llm", "inkling-2-mini", "thinking-machines", "nvfp4", "vllm", "inference", "benchmark"]
summary: "Thinking Machine's first accessible entry in its Inkling lineup."
cardImage: "cardimage.png"
---

{{< ctx-bar >}}
<span><strong>Tested in this article: </strong> thinkingmachines/Inkling-2-Mini NVFP4 (mixed NVFP4/MXFP8 checkpoint)  </span>

<span><strong>Hardware:</strong> RTX PRO 6000 Blackwell · 96 GB VRAM, 128 GB DDR4  </span>
<span><strong>OS:</strong> Debian 13  </span>
<span><strong>Engine:</strong> vLLM (`vllm/vllm-openai:inkling-2-mini`)  </span>
<span><strong>Benchmarks:</strong> BFCL v4, MMLU-Pro, IFEval, HumanEval+, MBPP+, Arena-Hard, Word500, (+ harness tests)</span>
{{< /ctx-bar >}}

<details>
<summary><strong>📊 Expand Model Config</strong></summary>

```yaml
  inkling-2-mini-nvfp4:
    cmd: >
      docker run --rm --name inkling-2-mini
      --gpus '"device=GPU-..."'
      --ipc=host --shm-size 16g
      -p 127.0.0.1:${PORT}:8000
      -v /llama-swap/models/inkling-2-mini:/model:ro
      -v /.cache/vllm-inkling:/root/.cache/vllm
      -v /.cache/flashinfer-inkling:/root/.cache/flashinfer
      -v /.cache/triton-inkling:/root/.triton/cache
      vllm/vllm-openai:inkling-2-mini
      /model
      --served-model-name inkling-2-mini-nvfp4
      --max-model-len 262144
      --max-num-seqs 8
      --gpu-memory-utilization 0.60
      --reasoning-parser inkling
      --tool-call-parser inkling --enable-auto-tool-choice
    cmdStop: docker stop inkling-2-mini
    proxy: http://127.0.0.1:${PORT}
```

I ran the provided container for this model. DSpark was not working day one, so it was excluded. A community patch later enabled it so you'll see that pop in later.

`--speculative-config '{"method":"dspark","num_speculative_tokens":7,"draft_sample_method":"probabilistic"}'`

</details>

{{< figure src="inkling-cover.png" width="100%" >}}

## Intro

I've been following Thinking Machines since Inkling dropped this summer. An American lab cooking up highly fine-tunable open-weight models naturally caught my interest. Up until now I've been unable to effectively run the models they've developed though. Inkling was almost a trillion params, Inkling-Small at 266B had no chance fitting in my 3090s at the time (and it didn't impress me when I did some light testing via OpenRouter), and then Inkling-2-Small came along and over doubled the size of its predecessor. Despite my absurd GPU purchase I was still kept out of the club. Small clearly doesn't mean to them what it means to us mortals trying to play along at home.

Enter [Inkling-2-Mini](https://huggingface.co/thinkingmachines/Inkling-2-Mini). TML finally dropped a model I can get my grubby little mitts on and I couldn't wait to test it out. Initial chatter was extremely positive. I was surprised it was so small. Going from "small" at ~600B params to "mini" at 26 is quite a hop, but as always params probably don't tell the whole story.

Could this extremely efficiently sized model replace Qwen as my daily driver? I've included some comparisons to Qwen3.8-27B and Gemma4-26B when appropriate as those are the most relevant models of the same size that came to mind. I use Qwen3.8-27B often and Gemma4-26B as a task model on my secondary card.

<!-- Model card facts for the table: https://huggingface.co/thinkingmachines/Inkling-2-Mini -->

| | [Inkling 2 Mini](https://huggingface.co/thinkingmachines/Inkling-2-Mini) |
|---|---|
| Developer | Thinking Machines Lab |
| Released | 20 Nov 2026 |
| License | Apache 2.0 |
| Type | Multimodal autoregressive looped transformer · text + image in, text out |
| Layers | 24 layers of weights; middle 12 run 3× with shared weights = 48 layer applications per token |
| MoE routing | 8 of 128 experts per token, per layer |
| Checkpoint | single ~20 GB, mixed NVFP4 + MXFP8 |
| Model card hardware | 1× DGX Spark · Apple silicon ≥32 GB · ≥32 GB VRAM recommended |
| Context served here | 262,144 (`--max-model-len`) |
| Native context | 262,144 (extendable to 1M) |
| Params (total / active) | 26.4B / 3.4B (5.4B active after loop) |


## Speed & Size

These runs used the pre-patch config, so no speculative decoding of any kind is included in these measurements.

### Prefill/Decode Sweep

Single stream synthetic sweep for a quick speed check. 512 tokens generated per run, prompt size walked from 1k out to the served `--max-model-len 262144`. Two reps per point; the charts and table are the mean of reps.

{{< chart type="line" height="320" >}}
{
  "labels": ["1k","8k","32k","131k","262k"],
  "datasets": [
    {"label":"Inkling 2 Mini (NVFP4)","data":[10683,21408,19453,13701,9583],"borderColor":"#7c5cfc","backgroundColor":"rgba(124,92,252,0.10)","tension":0.25,"pointRadius":4}
  ],
  "title": {"display":true,"text":"Inkling 2 Mini (NVFP4) · prefill (tok/s)","font":{"size":13,"weight":600},"padding":{"top":2,"bottom":10}},
  "legend": {"display":false},
  "scales": {
    "y": {"min":0,"max":24000,"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}},
    "x": {"title":{"display":true,"text":"prompt size","color":"#9898a8"},"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}}
  }
}
{{< /chart >}}

{{< chart type="line" height="320" >}}
{
  "labels": ["1k","8k","32k","131k","262k"],
  "datasets": [
    {"label":"Inkling 2 Mini (NVFP4)","data":[167.4,163.9,152.9,121.3,95.2],"borderColor":"#5cd6e0","backgroundColor":"rgba(92,214,224,0.10)","tension":0.25,"pointRadius":4}
  ],
  "title": {"display":true,"text":"Inkling 2 Mini (NVFP4) · decode (tok/s)","font":{"size":13,"weight":600},"padding":{"top":2,"bottom":10}},
  "legend": {"display":false},
  "scales": {
    "y": {"min":0,"max":200,"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}},
    "x": {"title":{"display":true,"text":"prompt size","color":"#9898a8"},"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}}
  }
}
{{< /chart >}}

{{< chart type="line" height="300" >}}
{
  "labels": ["1k","8k","32k","131k","262k"],
  "datasets": [
    {"label":"Inkling 2 Mini (NVFP4)","data":[0.09,0.34,1.47,8.32,23.79],"borderColor":"#ff6b9c","backgroundColor":"rgba(255,107,156,0.10)","tension":0.25,"pointRadius":4}
  ],
  "title": {"display":true,"text":"Inkling 2 Mini (NVFP4) · time to first token (s)","font":{"size":13,"weight":600},"padding":{"top":2,"bottom":10}},
  "legend": {"display":false},
  "scales": {
    "y": {"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}},
    "x": {"title":{"display":true,"text":"prompt size","color":"#9898a8"},"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}}
  }
}
{{< /chart >}}

<details>
<summary><strong>📊 Expand Speed Table</strong></summary>

Each row is the *mean of two reps*. The harness did not report engine-side prefill/decode numbers for this image, so there are no `srv` columns here:

| Prompt | Prompt tokens | TTFT | prefill tok/s | decode tok/s |
|---|---|---|---|---|
| 1k | 946 | 0.09 s | 10,683 | 167.4 |
| 8k | 7,179 | 0.34 s | 21,408 | 163.9 |
| 32k | 28,549 | 1.47 s | 19,453 | 152.9 |
| 131k | 114,031 | 8.32 s | 13,701 | 121.3 |
| 262k | 228,007 | 23.79 s | 9,583 | 95.2 |

Both reps as measured:

| Prompt | Rep | TTFT | prefill tok/s | decode tok/s |
|---|---|---|---|---|
| 1k | 1 | 0.10 s | 9,344 | 167.4 |
| 1k | 2 | 0.08 s | 12,022 | 167.5 |
| 8k | 1 | 0.34 s | 20,828 | 163.9 |
| 8k | 2 | 0.33 s | 21,988 | 163.9 |
| 32k | 1 | 1.47 s | 19,381 | 153.0 |
| 32k | 2 | 1.46 s | 19,524 | 152.8 |
| 131k | 1 | 8.30 s | 13,742 | 121.4 |
| 131k | 2 | 8.35 s | 13,659 | 121.3 |
| 262k | 1 | 23.71 s | 9,618 | 95.2 |
| 262k | 2 | 23.88 s | 9,548 | 95.2 |

</details>

Prefill/decode were stable up to 32k, but had a notable falloff up at the top range. These numbers make me committed to avoid context beyond the 262k range. The speed is pretty competitive to Qwen3.8-Flash-Next up to ~64k on my hardware, but falls well behind in long contexts. It bests Qwen3.8-27B in prefill at any level and only falls to match the decode at the full 262k.

### Concurrency

Same synthetic prompt pushed through 1, 2, 4 and 8 concurrent clients. 8192-token prompts for prefill/TTFT, then 512‑in / 512‑out for decode

{{< chart type="line" height="320" >}}
{
  "labels": ["1","2","4","8"],
  "datasets": [
    {"label":"Inkling 2 Mini (NVFP4)","data":[168.7,125.0,107.2,92.7],"borderColor":"#7c5cfc","backgroundColor":"rgba(124,92,252,0.10)","tension":0.25,"pointRadius":4}
  ],
  "title": {"display":true,"text":"Inkling 2 Mini (NVFP4) · per-client decode (tok/s)","font":{"size":13,"weight":600},"padding":{"top":2,"bottom":10}},
  "legend": {"display":false},
  "scales": {
    "y": {"min":0,"max":200,"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}},
    "x": {"title":{"display":true,"text":"concurrent clients","color":"#9898a8"},"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}}
  }
}
{{< /chart >}}

{{< chart type="line" height="320" >}}
{
  "labels": ["1","2","4","8"],
  "datasets": [
    {"label":"Inkling 2 Mini (NVFP4)","data":[168.7,249.6,428.1,740.7],"borderColor":"#5cd6e0","backgroundColor":"rgba(92,214,224,0.10)","tension":0.25,"pointRadius":4}
  ],
  "title": {"display":true,"text":"Inkling 2 Mini (NVFP4) · aggregate decode across all clients (tok/s)","font":{"size":13,"weight":600},"padding":{"top":2,"bottom":10}},
  "legend": {"display":false},
  "scales": {
    "y": {"min":0,"max":800,"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}},
    "x": {"title":{"display":true,"text":"concurrent clients","color":"#9898a8"},"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}}
  }
}
{{< /chart >}}

{{< chart type="line" height="300" >}}
{
  "labels": ["1","2","4","8"],
  "datasets": [
    {"label":"Inkling 2 Mini (NVFP4)","data":[0.32,0.64,1.30,2.63],"borderColor":"#ff6b9c","backgroundColor":"rgba(255,107,156,0.10)","tension":0.25,"pointRadius":4}
  ],
  "title": {"display":true,"text":"Inkling 2 Mini (NVFP4) · worst time to first token (s)","font":{"size":13,"weight":600},"padding":{"top":2,"bottom":10}},
  "legend": {"display":false},
  "scales": {
    "y": {"min":0,"max":3,"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}},
    "x": {"title":{"display":true,"text":"concurrent clients","color":"#9898a8"},"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}}
  }
}
{{< /chart >}}

<details>
<summary><strong>📊 Expand Concurrency Tables</strong></summary>

Table one is the per-client experience - each row is *aggregate prefill tok/s · worst TTFT · per-client decode tok/s* at that client count:

| Clients | agg prefill tok/s | TTFT (worst) | per-client decode tok/s | agg decode tok/s |
|---|---|---|---|---|
| 1 | 22,313 | 0.32 s | 168.7 | 168.7 |
| 2 | 22,496 | 0.64 s | 125.0 | 249.6 |
| 4 | 22,117 | 1.30 s | 107.2 | 428.1 |
| 8 | 21,828 | 2.63 s | 92.7 | 740.7 |

Table two is what the box as a whole puts out, aggregate decode tok/s, and how much of the theoretical 8x survived:

| | Inkling 2 Mini (NVFP4) |
|---|---|
| agg decode 1 → 8 | 168.7 → 740.7 (**x4.39**) |
| per-client retained at 8 | -45.1% |

</details>

Aggregate decode continued to scale nicely up to `n=8`. There is a bit of fall off on the individual streams, but the actual experienced decode and TTFT are more than sufficient for chat or coding. This model would likely be fantastic for subagents with a smaller context, likely not so much to serve concurrent full context streams.

### Size & memory

These numbers focus on how much VRAM is needed for a single stream at max ctx (262k). Once again, no spec decode - that will come up later. I dialed in to `--kv-cache-memory=24427626496` and ended up with 

- about 18.4 GiB for weights and CUDA/driver memory outside PyTorch
- 22.75 GiB for the KV cache
- under 1 GiB for CUDA graphs and leftover working memory

{{< chart type="bar" height="300" >}}
{
  "labels": ["VRAM","RAM"],
  "datasets": [
    {"label":"Inkling 2 Mini (NVFP4)","data":[41.98,2.67],"backgroundColor":["#7c5cfcac","#5cd6e0ac"],"borderColor":["#7c5cfc","#5cd6e0"],"borderWidth":2,"categoryPercentage":0.4,"barPercentage":0.9}
  ],
  "scales": {
    "y": {"min":0,"max":64,"title":{"display":true,"text":"GiB","color":"#9898a8"},"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}},
    "x": {"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}}
  }
}
{{< /chart >}}

<details>
<summary><strong>📊 Expand Memory Table</strong></summary>

| | Inkling 2 Mini (NVFP4) |
|---|---|
| Quant | NVFP4 + MXFP8 checkpoint |
| Size in VRAM | 42,986 MiB (42.0 GiB) |
| Size in RAM | 2,736 MiB (2.7 GiB) |
| On disk | 19,264 MiB (19.2 GiB)  |

</details>

These numbers are with BF16 KV. When quantization to 8-bit is available we'll see it a bit more efficient, but for now you'd need a VRAM pool at the 48GB tier to host a single full ctx stream. I'm sure we'll also see support in the expert-prediction, 3-tiered inference engines so those requirements will surely reduce over time.

## Traditional Benchmarks
*note these are not comparable to leaderboards - different sample size, different Arena Hard judge (DeepSeek V4-Flash).*

All six typical suites, Inkling-2-Mini next to Qwen3.8-27B and Gemma4-26B for context. The Qwen and Gemma columns are the results already published on the [/benchmarks page](/benchmarks/). Chart axis starts at 60 so the spread is visible.

{{< chart type="bar" height="380" >}}
{
  "labels": ["BFCL v4","IFEval","MBPP+","MMLU-Pro","Arena-Hard","HumanEval+"],
  "datasets": [
    {"label":"Inkling 2 Mini (NVFP4)","data":[76.00,88.80,97.35,80.48,97.52,95.12],"backgroundColor":"rgba(124,92,252,0.6)","borderColor":"#7c5cfc","borderWidth":2},
    {"label":"Qwen3.8-27B (NVFP4)","data":[85.00,79.60,93.65,80.48,98.78,90.24],"backgroundColor":"rgba(92,214,224,0.6)","borderColor":"#5cd6e0","borderWidth":2},
    {"label":"Gemma4-26B (NVFP4)","data":[82.67,86.80,93.92,83.10,95.98,95.73],"backgroundColor":"rgba(255,138,92,0.6)","borderColor":"#ff8a5c","borderWidth":2}
  ],
  "scales": {
    "y": {"min":60,"max":100,"title":{"display":true,"text":"accuracy / winrate (%)","color":"#9898a8"},"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}},
    "x": {"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}}
  }
}
{{< /chart >}}

<details>
<summary><strong>📊 Expand Benchmark Tables</strong></summary>

Scores, as percentages:

| Suite | Samples | Inkling 2 Mini | Qwen3.8-27B | Gemma4-26B |
|---|---|---|---|---|
| BFCL v4 | 300 | 76.00 | 85.00 | 82.67 |
| IFEval (prompt-strict) | 250 | 88.80 | 79.60 | 86.80 |
| MBPP+ | 378 | 97.35 | 93.65 | 93.92 |
| MMLU-Pro | 420 | 80.48 | 80.48 | 83.10 |
| Arena-Hard (winrate) | 75 | 97.52 | 98.78 | 95.98 |
| HumanEval+ | 164 | 95.12 | 90.24 | 95.73 |
| **mean of the six** | | **89.21** | **87.96** | **89.70** |

IFEval's four variants, prompt-strict is what's charted above:

| Variant | Inkling 2 Mini | Qwen3.8-27B | Gemma4-26B |
|---|---|---|---|
| prompt-level strict | 88.80 | 79.60 | 86.80 |
| instruction-level strict | 91.47 | 85.93 | 90.27 |
| prompt-level loose | 91.60 | 82.40 | 88.00 |
| instruction-level loose | 93.60 | 88.60 | 91.60 |

BFCL v4 by subset, 50 samples each:

| Subset | Inkling 2 Mini | Qwen3.8-27B | Gemma4-26B |
|---|---|---|---|
| simple_python | 86 | 92 | 98 |
| irrelevance | 84 | 86 | 84 |
| parallel | 84 | 90 | 80 |
| multiple | 80 | 90 | 92 |
| live_multiple | 68 | 82 | 86 |
| multi_turn_base | 54 | 70 | 56 |

MMLU-Pro by category, 30 samples each:

| Category | Inkling 2 Mini | Qwen3.8-27B | Gemma4-26B |
|---|---|---|---|
| math | 96.67 | 96.67 | 93.33 |
| physics | 96.67 | 93.33 | 100.00 |
| biology | 93.33 | 96.67 | 90.00 |
| chemistry | 90.00 | 90.00 | 86.67 |
| computer science | 90.00 | 86.67 | 90.00 |
| economics | 86.67 | 86.67 | 86.67 |
| health | 83.33 | 70.00 | 83.33 |
| philosophy | 83.33 | 83.33 | 76.67 |
| psychology | 83.33 | 80.00 | 83.33 |
| business | 80.00 | 83.33 | 83.33 |
| engineering | 80.00 | 83.33 | 86.67 |
| law | 66.67 | 63.33 | 80.00 |
| other | 53.33 | 53.33 | 56.67 |
| history | 43.33 | 60.00 | 66.67 |

Mean wall time per request, Inkling run only — the [/benchmarks page](/benchmarks/) data carries scores and subsets, not the per-suite perf block. The harness runs its own concurrency, so this mixes scheduling in with generation, and the comparators ran at different batch sizes. BFCL's tracker counts the individual tool-turn requests (1,279) rather than the 300 samples, so its latency is per turn.

| Suite | Mean latency | Avg output t/s | Mean output tokens |
|---|---|---|---|
| BFCL v4 | 4.93 s | 40.9 | 202 |
| HumanEval+ | 15.46 s | 88.6 | 1,370 |
| MBPP+ | 17.18 s | 85.2 | 1,464 |
| IFEval | 22.83 s | 83.6 | 1,908 |
| MMLU-Pro | 32.10 s | 82.3 | 2,640 |
| Arena-Hard | 50.78 s | 77.2 | 3,920 |

</details>

Inkling fell behind in the function calling test of BFCL-v4, most notably in `live_multiple` and `multi_turn_base`. Besides that it demonstrated a clear superiority in IFEval, MBPP+, and HumanEval+ over Qwen3.8-27B. Only in MMLU-Pro did Gemma4-26B have a small lead over Inkling. The overall for each category was not measurably different between the three. In general these benchmarks don't mean everything, but these results suggest Inkling may have a genuine lead in coding over our poster child (27B). We'll just have to see in the real world tests.

### Word500

Back to [the puzzle benchmark](/blog/word500_benchmark/) - guess the five letter word given only the counts of letters in the right place, wrong place, or nowhere. Measures reasoning effectiveness and efficiency.

**Details:** 6 boards x 10 samples = 60 runs, temp 1.0 / top_p 0.95, `max_tokens: 64000`, concurrency 6, loop-abort at 10 consecutive repeats. Three boards (Smoke, Poker, Hoard) each run twice: once as a screenshot, once as text only.

{{< chart type="bar" height="340" >}}
{
  "labels": ["Smoke","Poker","Hoard","Smoke (text)","Poker (text)","Hoard (text)","Overall"],
  "datasets": [
    {"label":"Inkling 2 Mini (NVFP4)","data":[100,80,70,90,80,80,83.33],"backgroundColor":["#7c5cfcac","#ff6b9cac","#f5b73dac","#5cd6e0ac","#a99bf0ac","#ff8a5cac","#e8e8f0b3"],"borderColor":["#7c5cfc","#ff6b9c","#f5b73d","#5cd6e0","#a99bf0","#ff8a5c","#e8e8f0"],"borderWidth":2}
  ],
  "title": {"display":true,"text":"Inkling 2 Mini (NVFP4) · correct guesses (%)","font":{"size":13,"weight":600},"padding":{"top":2,"bottom":10}},
  "legend": {"display":false},
  "scales": {
    "y": {"min":0,"max":110,"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}},
    "x": {"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}}
  }
}
{{< /chart >}}

{{< chart type="bar" height="340" >}}
{
  "labels": ["Smoke","Poker","Hoard","Smoke (text)","Poker (text)","Hoard (text)","Overall"],
  "datasets": [
    {"label":"Inkling 2 Mini (NVFP4)","data":[22283,28236,24352,21292,24436,19716,23386],"backgroundColor":["#7c5cfcac","#ff6b9cac","#f5b73dac","#5cd6e0ac","#a99bf0ac","#ff8a5cac","#e8e8f0b3"],"borderColor":["#7c5cfc","#ff6b9c","#f5b73d","#5cd6e0","#a99bf0","#ff8a5c","#e8e8f0"],"borderWidth":2}
  ],
  "title": {"display":true,"text":"Inkling 2 Mini (NVFP4) · avg output tokens per run","font":{"size":13,"weight":600},"padding":{"top":2,"bottom":10}},
  "legend": {"display":false},
  "scales": {
    "y": {"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}},
    "x": {"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}}
  }
}
{{< /chart >}}

<details>
<summary><strong>📊 Expand Word500 Table</strong></summary>

| Board | Correct | Accuracy | Format ok | Avg tokens | Max tokens | Loop aborts |
|---|---|---|---|---|---|---|
| Smoke | 10/10 | 100% | 10/10 | 22,283 | 35,358 | 0 |
| Poker | 8/10 | 80% | 9/10 | 28,236 | 61,009 | 1 |
| Hoard | 7/10 | 70% | 8/10 | 24,352 | 48,579 | 2 |
| Smoke (text) | 9/10 | 90% | 9/10 | 21,292 | 26,941 | 1 |
| Poker (text) | 8/10 | 80% | 8/10 | 24,436 | 41,376 | 2 |
| Hoard (text) | 8/10 | 80% | 8/10 | 19,716 | 36,242 | 2 |
| **overall** | **50/60** | **83.33%** | **52/60 (86.67%)** | **23,386** | **61,009** | **8** |

Overall token stats: total 1,403,156 · median 23,491 · min 1,118 · max 61,009. Eight loop aborts, zero truncated answers, zero request errors.

</details>

This was a really strong result in terms of accuracy, and overall much better than I expected. There were only two guesses that were incorrect. Eight of the attempts were identified as doom loops and terminated. Of the 52 guesses that were actually made, 50 were correct. 50/60 total tests gives us 83.3% and places the model 3rd in the leaderboard only behind comparatively massive models like GLM-5.3-Flash-Maya-M and Qwen3.8-Flash-Next. It beats Gemma4-26B (25/60) and Qwen3.8-27B (37/60). The overall average tokens per guess at 23.3k does put it in the mid-bottom end of efficiency though. There doesn't seem to be a measurable weakness to the vision capabilities, as is often seen in this test.

## In-Harness Tests

Curated suites need something to anchor them to reality. These are the same in-harness jobs I ran in the [Maya Review](/blog/project_maya_review/) and [Swift1.5 NVFP4 comparison](/blog/swift1.5_nvidia_nvfp4_comparison/), so Inkling 2 Mini lines up directly against the models in those entries.

### Open-WebUI Chat - Search, Reasoning, Function Calling

The same two-turn job:

1. Can you find a few recently released unified memory systems with 128gb+ ram and compare their prices/availability/pros and cons?
2. Can you format that information into a single page pdf so i can share it?

Same expectations as the prior entries: Nvidia RTX/DGX Spark, the M_ Ultra Mac Studios, the various Ryzen AI Max 395 mini pcs, MSRP, real prices, and pros/cons covering availability, memory size, bandwidth and compute. And of course it needs to find and call the PDF creation tool sitting in the harness.

#### Results

{{< model-report-tabs file="root:data/blog/inkling-2-mini-review/unified_memory_results.json" uid="umem" >}}

This model looks to be far from shy to use a tool. It explores its environment aggressively and widely, and doesn't hesitate to make as many tool calls as it possibly can to reach the goal. Noteworthy observations:
- It searched previous chats and my harness knowledge base before even touching web search, which I've never seen before. 
- It executed 37 web searches, which I'm pretty sure is a new record. I'd have to reel that in as to not get my IP blocked/throttled.
- Properly modulated search `n` to change the number of results based on complexity of search.
- It perfectly created tasks, updated as it went along, closed once finished (except for the final task, left it open. common behavior).
- Did not struggle to find Weasyprint & JetBrains to create the pdf.
- First render came out 2 pages, it caught and reformatted it.

I'm impressed with the outcome, even if it used tools and searched like crazy. It is better to lean that direction than too lazy.

### Pelican on a Bicycle

The classic silly prompt, as always. I placed Qwen3.8-27B and Gemma4-26B's art beside Inkling's for convenient comparison.

> Generate an SVG of a pelican riding a bicycle

{{< model-report-tabs file="root:data/blog/inkling-2-mini-review/pelican_results.json" kind="svg" uid="pelicans" >}}

Of these 3 Inkling is clearly the best. It isn't perfect, and doesn't beat the pelicans generated by bigger models like Flash-Next or GLM-5.3-Flash, but it's plenty impressive. The colors are nice and soft, the elements are clear. The wing/arm discrepancy, bike elongation, and some lines/layering are not ideal, but once again clearly the best in its weight class.

### Plex recommendation app

In VScode + Cline - A big, messy, directionless 1-shot attempt at a sort of application I may employ the model to create:

> Create a docker compose compatible web app that users can log into with a Plex account to browse popular shows/movies and be given show/movie recommendations based on their watch history and ratings.

**First attempt:**

<table style="width:100%; table-layout:fixed;">
<tr>
<th style="width:33.33%">Plex login</th>
<th style="width:33.33%">Main screen</th>
<th style="width:33.33%">For You</th>
</tr>
<tr>
<td style="width:33.33%"><img src="figures/plex-sign-in.png" alt="Inkling 2 Mini build, Plex login" style="width:100%"></td>
<td style="width:33.33%"><img src="figures/plex-popular.png" alt="Inkling 2 Mini build, main screen" style="width:100%"></td>
<td style="width:33.33%"><img src="figures/plex-recs.png" alt="Inkling 2 Mini build, Recommendations page" style="width:100%"></td>
</tr>
</table>

I've run this on the larger models I've tested previously, and none were able to truly 1-shot it. Inkling absolutely rocked this test and demolished my expectations. In one shot with zero follow up corrective prompts it created a fully functional app. 
- The sign in screen was clear and authenticated with Plex. 
- The landing page pulled TMDB data cleanly.
- The settings let me connect my server and pull my watch/rate data seamlessly and populated the Recommendations page

The model didn't take the liberty to generate a fun name for the app like Flash-Next did, but with the functional and precise outcome I'm actually okay with that. The model followed its instruction with precision and didn't take creative liberties where not needed.

| | Inkling 2 Mini |
|---|---|
| First response | Clean and modern GUI |
| Plex auth | Functional |
| TMDB key | Populated in .env, grabbed data successfully |
| Prompts to reach a working build | 1 |
| Watch history → recommendations | Strong recs built on watch/rating history |
| 1-shot? | Yes! |

Generated app: Flask + SQLite + docker-compose, single container, TMDB for catalog
data, Plex OAuth PIN for sign-in, optional Plex server sync for watch history.
Source kept with the run data; app is named "inkling-2-mini" in its own README.
Prior entries in this test: [Swift/Nvidia QFN3.8](/blog/swift1.5_nvidia_nvfp4_comparison/) and
[Maya](/blog/project_maya_review/#plex-recommendation-app)

### Designing a server case

In Hermes harness - This is another real world test that mirrors a project I've been working on - I've designed and built a new case for my LLM rig. Could it 1-shot a 3D representation of the efficient build I brainstormed over weeks? Probably not, but let's see what it output.

> Let's design a case for a server that supports standard ATX motherboard and power supply. It should support an RTX 6000 Blackwell and an Evga 3090 FTW3.
>
> The primary focus should be keeping the case compact and maximizing airflow.
>
> Your output should be a 3D representation of the case for easy viewing.

{{< figure src="server_case/server-case-model.png" width="100%" >}}

The viewer below is the real artifact, drag to orbit and scroll to zoom. Three.js, loaded from a CDN, in a self-contained page. Expand to load it.

<details>
<summary><strong>🖥 Inkling 2 Mini build - AERO-ATX X2, 23.0L (169 × 404 × 337 mm), interactive 3D</strong></summary>

<iframe src="/blog/inkling-2-mini-review/viewers/server-case.html" loading="lazy" title="Inkling 2 Mini build 3D case viewer" style="width:100%;height:1080px;border:1px solid #2a2a3a;border-radius:8px;background:#12161d"></iframe>

[Open full](/blog/inkling-2-mini-review/viewers/server-case.html) &#8599;

</details>

- The created visualizer is functional and clear besides the grey name on white background.
- The model itself is not laid out correctly. Missing a GPU, motherboard against the wrong wall, not quite to scale.
- Rotation/explosion features are excellent

Overall better than expected. I didn't even originally plan to run this test with this model (I haven't with Qwen3.8-27B or Gemma4-26B for example because I didn't expect them to handle it in a worthwhile way), but the Plex app turning out as strong as it did showed me this model is batting out of its league. I think with a few more passes it would shape up to something valuable. Even in its current state it is substantially better than the results I saw in my original Qwen3.8-Flash-Next comparison post. It did take many more turns than the other models I've ran this against - 3 cycles of hitting Hermes' preset 250 turn limit.

## DSpark Speculative Decoding

On drop I could not get the drafter working. I hunted around to no avail and ended up removing it from the config. The next day I looked around again and found a community fix available while we wait for the official fix.

<details>
<summary><strong>🔧 The crash, the patch, and the two lines that change</strong></summary>

- The `vllm/vllm-openai:inkling-2-mini` image ships compiled for datacenter Blackwell only (`sm_100`/`sm_103`). The KV-cache write op Inkling's bundled DSpark drafter calls has no kernel for the RTX PRO 6000 (`sm_120`), so enabling speculative decoding crashes during warmup.
- The community patch swaps in a small Triton kernel that performs the same write on `sm_120` with a bf16 KV cache. It is mounted over the file in the image rather than baked into it:

```
      -v /models/inkling-2-mini/dspark-patch/dspark.py:/usr/local/lib/python3.14/dist-packages/vllm/models/inkling2/nvidia/dspark.py:ro
```

- and the serving flag:

```
      --speculative-config '{"method":"dspark","num_speculative_tokens":7,"draft_sample_method":"probabilistic"}'
```
- Patch HF: [Lewfkrad/Inkling-2-Mini-DSpark-sm120-vllm-patch](https://huggingface.co/Lewfkrad/Inkling-2-Mini-DSpark-sm120-vllm-patch)
- Official fix is [PR #69096](https://github.com/vllm-project/vllm/pull/69096), still open and unmerged, so the patch is a stopgap that can be dropped once a fixed image or the vLLM 0.35 release ships.

</details>

The early adoption experience is often a struggle, but this sort of hurdle makes it a grind. I'm looking forward to when we get full, stable support in mainline vLLM.

### Spec Decode Speed

Same single stream sweep, same five prompt sizes, re-run with the patch and `num_speculative_tokens: 7`. Two reps per point; the charts are the mean of reps.

{{< chart type="line" height="340" >}}
{
  "labels": ["1k","8k","32k","131k","262k"],
  "datasets": [
    {"label":"no spec decode","data":[10683,21408,19453,13701,9583],"borderColor":"#7c5cfc","backgroundColor":"rgba(124,92,252,0.10)","tension":0.25,"pointRadius":4},
    {"label":"DSpark spec decode","data":[10328,21190,19324,13654,9561],"borderColor":"#5cd6e0","backgroundColor":"rgba(92,214,224,0.10)","tension":0.25,"pointRadius":4}
  ],
  "title": {"display":true,"text":"Inkling 2 Mini (NVFP4) · prefill (tok/s)","font":{"size":13,"weight":600},"padding":{"top":2,"bottom":10}},
  "scales": {
    "y": {"min":0,"max":24000,"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}},
    "x": {"title":{"display":true,"text":"prompt size","color":"#9898a8"},"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}}
  }
}
{{< /chart >}}

{{< chart type="line" height="340" >}}
{
  "labels": ["1k","8k","32k","131k","262k"],
  "datasets": [
    {"label":"no spec decode","data":[167.4,163.9,152.9,121.3,95.2],"borderColor":"#7c5cfc","backgroundColor":"rgba(124,92,252,0.10)","tension":0.25,"pointRadius":4},
    {"label":"DSpark spec decode","data":[199.5,195.8,190.4,161.1,134.6],"borderColor":"#5cd6e0","backgroundColor":"rgba(92,214,224,0.10)","tension":0.25,"pointRadius":4}
  ],
  "title": {"display":true,"text":"Inkling 2 Mini (NVFP4) · decode (tok/s)","font":{"size":13,"weight":600},"padding":{"top":2,"bottom":10}},
  "scales": {
    "y": {"min":0,"max":220,"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}},
    "x": {"title":{"display":true,"text":"prompt size","color":"#9898a8"},"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}}
  }
}
{{< /chart >}}

{{< chart type="line" height="320" >}}
{
  "labels": ["1k","8k","32k","131k","262k"],
  "datasets": [
    {"label":"no spec decode","data":[0.09,0.34,1.47,8.32,23.79],"borderColor":"#7c5cfc","backgroundColor":"rgba(124,92,252,0.10)","tension":0.25,"pointRadius":4},
    {"label":"DSpark spec decode","data":[0.09,0.34,1.48,8.35,23.85],"borderColor":"#ff6b9c","backgroundColor":"rgba(255,107,156,0.10)","tension":0.25,"pointRadius":4}
  ],
  "title": {"display":true,"text":"Inkling 2 Mini (NVFP4) · time to first token (s)","font":{"size":13,"weight":600},"padding":{"top":2,"bottom":10}},
  "scales": {
    "y": {"min":0,"max":28,"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}},
    "x": {"title":{"display":true,"text":"prompt size","color":"#9898a8"},"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}}
  }
}
{{< /chart >}}

<details>
<summary><strong>📊 Expand Spec Decode Speed Table</strong></summary>

Each row is the *mean of two reps*:

| Prompt | Prompt tokens | TTFT | prefill tok/s | decode tok/s |
|---|---|---|---|---|
| 1k | 946 | 0.09 s | 10,328 | 199.5 |
| 8k | 7,179 | 0.34 s | 21,190 | 195.8 |
| 32k | 28,549 | 1.48 s | 19,324 | 190.4 |
| 131k | 114,031 | 8.35 s | 13,654 | 161.1 |
| 262k | 228,007 | 23.85 s | 9,561 | 134.6 |

Both reps as measured:

| Prompt | Rep | TTFT | prefill tok/s | decode tok/s |
|---|---|---|---|---|
| 1k | 1 | 0.11 s | 8,955 | 195.5 |
| 1k | 2 | 0.08 s | 11,701 | 203.5 |
| 8k | 1 | 0.35 s | 20,448 | 191.3 |
| 8k | 2 | 0.33 s | 21,933 | 200.3 |
| 32k | 1 | 1.48 s | 19,232 | 186.1 |
| 32k | 2 | 1.47 s | 19,417 | 194.6 |
| 131k | 1 | 8.32 s | 13,702 | 157.0 |
| 131k | 2 | 8.38 s | 13,606 | 165.1 |
| 262k | 1 | 23.74 s | 9,605 | 130.0 |
| 262k | 2 | 23.96 s | 9,518 | 139.3 |

The deltas, no-spec → DSpark:

| | no spec | DSpark | delta |
|---|---|---|---|
| decode @ 1k | 167.4 | 199.5 | **+19.2%** |
| decode @ 8k | 163.9 | 195.8 | **+19.5%** |
| decode @ 32k | 152.9 | 190.4 | **+24.5%** |
| decode @ 131k | 121.3 | 161.1 | **+32.8%** |
| decode @ 262k | 95.2 | 134.6 | **+41.4%** |
| prefill @ 32k | 19,453 | 19,324 | -0.7% |
| TTFT @ 32k | 1.47 s | 1.48 s | |
| agg decode @ 8 clients | 740.7 | 916.4 | **+23.7%** |

</details>

A solid 19.2-41.4% gain depending on ctx and no change to prefill/TTFT.

### Spec Decode Concurrency

Same 1/2/4/8 client ladder, re-run under DSpark.

{{< chart type="line" height="340" >}}
{
  "labels": ["1","2","4","8"],
  "datasets": [
    {"label":"no spec decode","data":[168.7,125.0,107.2,92.7],"borderColor":"#7c5cfc","backgroundColor":"rgba(124,92,252,0.10)","tension":0.25,"pointRadius":4},
    {"label":"DSpark spec decode","data":[206.8,165.7,138.9,120.6],"borderColor":"#5cd6e0","backgroundColor":"rgba(92,214,224,0.10)","tension":0.25,"pointRadius":4}
  ],
  "title": {"display":true,"text":"Inkling 2 Mini (NVFP4) · per-client decode (tok/s)","font":{"size":13,"weight":600},"padding":{"top":2,"bottom":10}},
  "scales": {
    "y": {"min":0,"max":240,"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}},
    "x": {"title":{"display":true,"text":"concurrent clients","color":"#9898a8"},"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}}
  }
}
{{< /chart >}}

{{< chart type="line" height="340" >}}
{
  "labels": ["1","2","4","8"],
  "datasets": [
    {"label":"no spec decode","data":[168.7,249.6,428.1,740.7],"borderColor":"#7c5cfc","backgroundColor":"rgba(124,92,252,0.10)","tension":0.25,"pointRadius":4},
    {"label":"DSpark spec decode","data":[206.8,329.5,534.1,916.4],"borderColor":"#5cd6e0","backgroundColor":"rgba(92,214,224,0.10)","tension":0.25,"pointRadius":4}
  ],
  "title": {"display":true,"text":"Inkling 2 Mini (NVFP4) · aggregate decode across all clients (tok/s)","font":{"size":13,"weight":600},"padding":{"top":2,"bottom":10}},
  "scales": {
    "y": {"min":0,"max":1000,"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}},
    "x": {"title":{"display":true,"text":"concurrent clients","color":"#9898a8"},"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}}
  }
}
{{< /chart >}}

<details>
<summary><strong>📊 Expand Spec Decode Concurrency Tables</strong></summary>

| Clients | agg prefill tok/s | TTFT (worst) | per-client decode tok/s | agg decode tok/s |
|---|---|---|---|---|
| 1 | 22,244 | 0.32 s | 206.8 | 206.8 |
| 2 | 22,342 | 0.64 s | 165.7 | 329.5 |
| 4 | 22,044 | 1.30 s | 138.9 | 534.1 |
| 8 | 21,701 | 2.65 s | 120.6 | 916.4 |

| | no spec | DSpark |
|---|---|---|
| agg decode 1 → 8 | 168.7 → 740.7 (**x4.39**) | 206.8 → 916.4 (**x4.43**) |
| per-client retained at 8 | -45.1% | -41.7% |
| TTFT at 8 clients | 2.63 s | 2.65 s |

</details>

Once again a 23.7% gain over no spec decode at the ctx tested.

### What the patch costs

{{< chart type="bar" height="320" >}}
{
  "labels": ["VRAM","RAM"],
  "datasets": [
    {"label":"no spec decode","data":[41.98,2.67],"backgroundColor":"#7c5cfcac","borderColor":"#7c5cfc","borderWidth":2,"categoryPercentage":0.72,"barPercentage":0.9},
    {"label":"DSpark spec decode","data":[46.02,3.21],"backgroundColor":"#5cd6e0ac","borderColor":"#5cd6e0","borderWidth":2,"categoryPercentage":0.72,"barPercentage":0.9}
  ],
  "scales": {
    "y": {"min":0,"max":64,"title":{"display":true,"text":"GiB","color":"#9898a8"},"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}},
    "x": {"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}}
  }
}
{{< /chart >}}

| | no spec | DSpark | delta |
|---|---|---|---|
| Size in VRAM | 42,986 MiB (42.0 GiB) | 47,120 MiB (46.0 GiB) | +4,134 MiB (**+9.6%**) |
| Size in RAM | 2,736 MiB (2.7 GiB) | 3,282 MiB (3.2 GiB) | +546 MiB (**+20.0%**) |

The draft model isn't free, but is clearly worth the boost if you have the spare 4GB VRAM (which luckily I do). In the case that I load this into my secondary GPU (RTX 3090) I'll likely disable it, but if this proves to be a more primary model for me I'll take that speed boost every time. The patch also locks the config to BF16 KV while running DSpark.

## Conclusion

{{< verdict >}}
<p class="verdict-lead">tl;dr</p>

- Inkling-2-Mini is a solid model. It benchmarks well and is extremely capable in the right harness. Coding benchmarks lean to favor Inkling over Gemma4-26B and Qwen3.8-27B.
- It thinks a LOT and uses a LOT of tool calls, somewhat inefficient from this angle but does good work with the extra. It punched way outside its weight class in terms of accuracy for Word500, but fell near the bottom in terms of efficiency. Experienced some looping reasoning.
- Generally ties or outperforms Qwen3.8-27B and Gemma4-26B in my tests, and even Glm-5.3-Flash-Maya-M and Qwen3.8-Flash-Next-NVFP4 in some.
- Compatibility this early on isn't perfect, but Inky Mini is clearly a very serious model.

While running these tests I utilized the model in OpenWebUI for planning/brainstorming. I was consistently impressed with both its prose and tool calling capabilities. In the coming days I'll be pulling a Q4 gguf and swapping Gemma4-26B out as my task model on my 3090. It will likely take more VRAM for the same KV and run slower, but the capability difference is notable. The results of these tests suggest it would be fully sufficient as my primary driver. I will give it a go in place of Qwen3.8-Flash-Next and 27B for the next few days to really get a feel for its capabilities/nuances.

{{< /verdict >}}











