---
title: "Project Maya Review"
date: 2026-11-06T12:00:00Z
publishDate: 2026-11-06T12:00:00Z
draft: false
tags: ["llm", "glm-5.3", "maya", "2bit", "inference", "benchmark"]
summary: "Another snowflake inference engine, does it make GLM-5.3-Flash worth running?"
---

{{< ctx-bar >}}
<span><strong>Tested in this article: </strong> peasantsmith/GLM-5.3-Flash-Maya-GGUF IQ2_S ("Maya-M")  </span>

<span><strong>Hardware:</strong> RTX 6000 Blackwell · 96 GB VRAM, 128 GB DDR4  </span>
<span><strong>OS:</strong> Debian 13  </span>
<span><strong>Engine:</strong> Project Maya </span>
<span><strong>Benchmarks:</strong> BFCL v4, MMLU-Pro, IFEval, HumanEval+, MBPP+, Arena-Hard, Word500, (+ harness tests)</span>
{{< /ctx-bar >}}

<details>
<summary><strong>📊 Expand Model Config</strong></summary>

```sh
./maya.sh --setup \
  --port 8123 \
  --gguf-dir /models/glm-5.3-flash/Maya-M \
  --context 262144 \
  --parallel 1
```

A great deal of the configuration happens by Maya automatically. On load it checks your hardware and runs measurements to figure out exactly the best layer split across the 3 tiers. Even after that, you can configure everything in the GUI and not much has to go into your initial launch. I didn't want it to download to its default location and wanted it to not use the same port 8080 everything else wants, so i set those myself.

</details>

## Intro

The neverending wave of specialized inference engines designed to run select models on specific hardware continues to batter the shores of our local machines. This week, [Project Maya](https://github.com/mw00/project-maya) caught my eye. It's another expert caching, 3-tier-fitting, streaming engine set to run GLM-5.3-Flash, DeepSeek-V4.1-Flash-1017 and MiniMax-M3.1-Flash. 

Project Maya comes with its own nice WebUI and terminal UI.
<table style="width:100%; table-layout:fixed;">
<tr>
<th style="width:50%" colspan="3">Terminal</th>
<th style="width:50%" colspan="3">WebUI</th>
</tr>
<tr>
<td colspan="3"><img src="gui/terminal.png" alt="Maya-M terminal-ui" style="width:100%"></td>
<td colspan="3"><img src="gui/webui.png" alt="Maya-M WebUI" style="width:100%"></td>
</tr>
<tr>
<th colspan="6">WebUI Monitor Panel</th>
</tr>
<tr>
<td colspan="2"><img src="gui/monitor1.png" alt="Maya-M monitor panel, throughput and context" style="width:100%"></td>
<td colspan="2"><img src="gui/monitor2.png" alt="Maya-M monitor panel, expert placement and GPU memory" style="width:100%"></td>
<td colspan="2"><img src="gui/monitor3.png" alt="Maya-M monitor panel, hardware and recent requests" style="width:100%"></td>
</tr>
</table>

The primary characteristic between the models these engines advertise is lobotomized tiny quants. Yes, you're getting 200 tok/s decode on your 2 x 3060 12gb rig, but at IQ1_S does it matter? I've been hesitant to dive in too much, but I've really wanted to try GLM-5.3-Flash so decided to set it up.

{{< figure src="wrong_calculations.jpg" width="40%" >}}

Expert cache is the primary point of intrigue here for me, but KV streaming from RAM and the overall 3-tier expert parking is an intelligent layout. I likely would have little interest in a model that tips beyond VRAM+RAM into SSD, but the option is interesting.

I went with the quant labeled "Maya-M" which shows as IQ2_S on [HuggingFace](https://huggingface.co/peasantsmith/GLM-5.3-Flash-Maya-GGUF) since it was the right size to exceed my VRAM, but not by too much. Looking into the quant details in the model card it's clear that '2-bit' does undersell it to a degree:

| Tensors | Maya-M |
|---|---|
| Routed experts, gate and up (42 layers) | IQ2_S, rounded with error feedback |
| Routed experts, down | IQ3_S in the first and last four MoE layers, IQ3_XXS in the rest |
| Attention projections (KDA, MLA/DSA) and shared experts | Q6_K |
| The three dense layers, embeddings, output, MLA k_b / v_b | Q6_K |
| Small KDA projections, the DSA indexer | Q8_0 |
| Router, norms, stream-mixing weights | F32 |
| NextN draft layer experts | Q3_K (gate/up), Q4_K (down) |

Doing the math its really something more along 2.7-bit (or 2.9-bit if you go just off file size). Still a far step from the minimum 4-bit floor that has felt usable in other models I've tried. 

My goal with this article is to measure GLM-5.3-Flash at this quant in this engine and determine if the deep quantization doesn't render the model too damaged AND to consider the speed difference. My current "use 100% of my machine's brain" model is Qwen3.8-flash-next-nvfp4. This would have to perform pretty impressively and token-efficiently for me to swap. I'll start with a speed analysis, run the typical benchmark suites, and end with real world style in-harness uses. 

## Speed & Size

First things first, how fast is this model on my hardware? I originally configured the model to run with MTP, Maya's measurements said thats slower. I then tried with the dflash2 draft model - it once again measured and said no dice. So these numbers are without spec of any kind.

### Prefill/Decode Sweep

Single stream synthetic sweep for a quick speed check. 512 tokens generated per run, prompt size walked from 1k out to the served `--context 262144`. Two reps per point; the charts and table are the mean of reps.

{{< chart type="line" height="320" >}}
{
  "labels": ["1k","8k","32k","131k","262k"],
  "datasets": [
    {"label":"Maya-M (IQ2_S)","data":[1336,3535,3824,3691,3425],"borderColor":"#7c5cfc","backgroundColor":"rgba(124,92,252,0.10)","tension":0.25,"pointRadius":4}
  ],
  "title": {"display":true,"text":"Maya-M (IQ2_S) · prefill (tok/s)","font":{"size":13,"weight":600},"padding":{"top":2,"bottom":10}},
  "legend": {"display":false},
  "scales": {
    "y": {"min":0,"max":4200,"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}},
    "x": {"title":{"display":true,"text":"prompt size","color":"#9898a8"},"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}}
  }
}
{{< /chart >}}

{{< chart type="line" height="320" >}}
{
  "labels": ["1k","8k","32k","131k","262k"],
  "datasets": [
    {"label":"Maya-M (IQ2_S)","data":[77.0,68.3,67.7,64.4,60.7],"borderColor":"#5cd6e0","backgroundColor":"rgba(92,214,224,0.10)","tension":0.25,"pointRadius":4}
  ],
  "title": {"display":true,"text":"Maya-M (IQ2_S) · decode (tok/s)","font":{"size":13,"weight":600},"padding":{"top":2,"bottom":10}},
  "legend": {"display":false},
  "scales": {
    "y": {"min":0,"max":100,"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}},
    "x": {"title":{"display":true,"text":"prompt size","color":"#9898a8"},"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}}
  }
}
{{< /chart >}}

{{< chart type="line" height="300" >}}
{
  "labels": ["1k","8k","32k","131k","262k"],
  "datasets": [
    {"label":"Maya-M (IQ2_S)","data":[0.71,2.03,7.47,30.89,66.58],"borderColor":"#ff6b9c","backgroundColor":"rgba(255,107,156,0.10)","tension":0.25,"pointRadius":4}
  ],
  "title": {"display":true,"text":"Maya-M (IQ2_S) · time to first token (s)","font":{"size":13,"weight":600},"padding":{"top":2,"bottom":10}},
  "legend": {"display":false},
  "scales": {
    "y": {"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}},
    "x": {"title":{"display":true,"text":"prompt size","color":"#9898a8"},"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}}
  }
}
{{< /chart >}}

<details>
<summary><strong>📊 Expand Speed Table</strong></summary>

Each row is the *mean of two reps*; the last two columns are the engine's own reported prefill/decode tok/s for comparison with the client-measured numbers:

| Prompt | Prompt tokens | TTFT | prefill tok/s | decode tok/s | srv prefill | srv decode |
|---|---|---|---|---|---|---|
| 1k | 944 | 0.71 s | 1,336 | 77.0 | 1,340 | 77.1 |
| 8k | 7,176 | 2.03 s | 3,535 | 68.3 | 3,646 | 68.4 |
| 32k | 28,547 | 7.47 s | 3,824 | 67.7 | 3,923 | 67.9 |
| 131k | 114,029 | 30.89 s | 3,691 | 64.4 | 3,748 | 64.6 |
| 262k | 228,004 | 66.58 s | 3,425 | 60.7 | 3,472 | 60.8 |

</details>

Overall VERY usable numbers. A 3.8k tok/s prefill and 68 tok/s decode at 32k is acceptable for chat and coding. It also maintained some nice stable numbers as context grew, never falling off a cliff. Still a far cry of the 16k / 160 tok/s I experience with Qwen3.8-flash-next-nvfp4 on vLLM.

### Concurrency

Same synthetic prompt pushed through 1, 2, 4 and 8 concurrent clients. I of course had to increase the parallel count in the config to accomplish this (I reduced it after).

{{< chart type="line" height="320" >}}
{
  "labels": ["1","2","4","8"],
  "datasets": [
    {"label":"Maya-M (Maya engine)","data":[70.4,47.9,28.9,15.3],"borderColor":"#7c5cfc","backgroundColor":"rgba(124,92,252,0.10)","tension":0.25,"pointRadius":4}
  ],
  "title": {"display":true,"text":"Maya-M (Maya engine) · per-client decode (tok/s)","font":{"size":13,"weight":600},"padding":{"top":2,"bottom":10}},
  "legend": {"display":false},
  "scales": {
    "y": {"min":0,"max":80,"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}},
    "x": {"title":{"display":true,"text":"concurrent clients","color":"#9898a8"},"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}}
  }
}
{{< /chart >}}

{{< chart type="line" height="320" >}}
{
  "labels": ["1","2","4","8"],
  "datasets": [
    {"label":"Maya-M (Maya engine)","data":[70.4,92.6,108.4,111.8],"borderColor":"#5cd6e0","backgroundColor":"rgba(92,214,224,0.10)","tension":0.25,"pointRadius":4}
  ],
  "title": {"display":true,"text":"Maya-M (Maya engine) · aggregate decode across all clients (tok/s)","font":{"size":13,"weight":600},"padding":{"top":2,"bottom":10}},
  "legend": {"display":false},
  "scales": {
    "y": {"min":0,"max":120,"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}},
    "x": {"title":{"display":true,"text":"concurrent clients","color":"#9898a8"},"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}}
  }
}
{{< /chart >}}

{{< chart type="line" height="300" >}}
{
  "labels": ["1","2","4","8"],
  "datasets": [
    {"label":"Maya-M (Maya engine)","data":[2.00,3.89,7.79,15.89],"borderColor":"#ff6b9c","backgroundColor":"rgba(255,107,156,0.10)","tension":0.25,"pointRadius":4}
  ],
  "title": {"display":true,"text":"Maya-M (Maya engine) · worst time to first token (s)","font":{"size":13,"weight":600},"padding":{"top":2,"bottom":10}},
  "legend": {"display":false},
  "scales": {
    "y": {"min":0,"max":18,"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}},
    "x": {"title":{"display":true,"text":"concurrent clients","color":"#9898a8"},"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}}
  }
}
{{< /chart >}}

<details>
<summary><strong>📊 Expand Concurrency Tables</strong></summary>

Table one is the per-client experience - each cell is *aggregate prefill tok/s · worst TTFT · per-client decode tok/s* at that client count:

| Clients | agg prefill tok/s | TTFT (worst) | per-client decode tok/s | agg decode tok/s |
|---|---|---|---|---|
| 1 | 3,590 | 2.00 s | 70.4 | 70.4 |
| 2 | 3,690 | 3.89 s | 47.9 | 92.6 |
| 4 | 3,686 | 7.79 s | 28.9 | 108.4 |
| 8 | 3,614 | 15.89 s | 15.3 | 111.8 |

Table two is what the box as a whole puts out, aggregate decode tok/s, and how much of the theoretical 8x survived:

| | Maya-M |
|---|---|
| agg decode 1 → 8 | 70.4 → 111.8 (**x1.59**) |
| per-client retained at 8 | -78.3% |

</details>

Clearly not worth running concurrently, and a SUPER far fall behind what I see in vLLM with my golden child model. With that said, I was surprised to see the numbers at `n=2` are actually still rather usable single stream and do add up to a net positive. If I needed to support 2 users who didn't mind a middling decode performance this could be viable.

### Size & memory


{{< chart type="bar" height="300" >}}
{
  "labels": ["Maya-M (IQ2_S)"],
  "datasets": [
    {"label":"VRAM","data":[95],"backgroundColor":"#7c5cfcac","borderColor":"#7c5cfc","borderWidth":2},
    {"label":"RAM","data":[48.7],"backgroundColor":"#5cd6e0ac","borderColor":"#5cd6e0","borderWidth":2},
    {"label":"RAM-Pinned Experts","data":[28],"backgroundColor":"#ff6b9cac","borderColor":"#ff6b9c","borderWidth":2}
  ],
  "scales": {
    "y": {"min":0,"max":128,"title":{"display":true,"text":"GiB","color":"#9898a8"},"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}},
    "x": {"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}}
  }
}
{{< /chart >}}

<details>
<summary><strong>📊 Expand Memory Table</strong></summary>

| | Maya-M (Maya engine) |
|---|---|
| Quant | IQ2_S, ~2.9-bit effective (experts ~2.7-bit, 2.5/3-bit mix) |
| VRAM used | 95 GiB of 96 |
| RAM used | 48.7 GiB of 128 |
| of which pinned for experts | 28 GiB |
| On disk | 116 GiB |

</details>

My hardware is nicely set up for this size model through this engine. 86% of the experts sit in VRAM, the rest in ram. Nothing spilled into SSD, so I didn't really test the FULL stack this engine offers.

#### The GUI gives a nice breakdown of how everything lays out:
{{< figure src="gui/hardware_load.png" width="100%" >}}

This also gives us a solid anchor to check the effectiveness of the expert cache. Throughout some early tests I saw cache hits range from 96.4% to 99.2%. This range CLEARLY beats a random expert pull against 86%, so the cache is a notable net win.

## Traditional Benchmarks
*note these are not comparable to leaderboards - different sample size, different Arena Hard judge.*

All six typical suites, one model. Ran 5 Nov 2026 through [Project Maya](https://github.com/mw00/project-maya) at server default temperature and 16k max tokens (64k for Arena-Hard), `batch_size 1`.

{{< chart type="bar" height="380" >}}
{
  "labels": ["BFCL v4","IFEval","MBPP+","MMLU-Pro","Arena-Hard","HumanEval+"],
  "datasets": [
    {"label":"Maya-M (IQ2_S)","data":[79.00,77.60,92.06,78.81,90.91,86.59],"backgroundColor":["#7c5cfcac","#5cd6e0ac","#ff6b9cac","#f5b73dac","#a99bf0ac","#ff8a5cac"],"borderColor":["#7c5cfc","#5cd6e0","#ff6b9c","#f5b73d","#a99bf0","#ff8a5c"],"borderWidth":2,"categoryPercentage":0.72,"barPercentage":0.92}
  ],
  "title": {"display":true,"text":"Maya-M (IQ2_S) · benchmark score (%)","font":{"size":13,"weight":600},"padding":{"top":2,"bottom":10}},
  "legend": {"display":false},
  "scales": {
    "y": {"min":0,"max":100,"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}},
    "x": {"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}}
  }
}
{{< /chart >}}

<details>
<summary><strong>📊 Expand Benchmark Tables</strong></summary>

Scores, as percentages:

| Suite | Samples | Maya-M (IQ2_S) |
|---|---|---|
| BFCL v4 | 300 | 79.00 |
| IFEval (prompt-strict) | 250 | 77.60 |
| MBPP+ | 378 | 92.06 |
| MMLU-Pro | 420 | 78.81 |
| Arena-Hard (winrate) | 75 | 90.91 |
| HumanEval+ | 164 | 86.59 |
| **mean of the six** | | **84.16** |

IFEval's other three variants (prompt-strict is what's charted) - instruction-level strict 84.73, prompt-level loose 82.00, instruction-level loose 87.67.

BFCL v4 by subset, 50 samples each:

| Subset | Maya-M |
|---|---|
| simple_python | 98 |
| multiple | 88 |
| parallel | 86 |
| irrelevance | 62 |
| live_multiple | 72 |
| multi_turn_base | 68 |

MMLU-Pro by category, 30 samples each:

| Category | Maya-M | Category | Maya-M |
|---|---|---|---|
| biology | 96.67 | psychology | 76.67 |
| math | 93.33 | computer science | 73.33 |
| physics | 90.00 | health | 70.00 |
| chemistry | 86.67 | philosophy | 70.00 |
| business | 86.67 | other | 70.00 |
| economics | 86.67 | law | 63.33 |
| engineering | 80.00 | history | 60.00 |

Mean wall time per request. The harness runs its own concurrency, so this mixes scheduling in with generation. BFCL's tracker counts the individual tool-turn requests (931) rather than the 300 samples, so its latency is per turn.

| Suite | Mean latency | Avg output t/s | Mean output tokens |
|---|---|---|---|
| BFCL v4 | 2.84 s | 55.7 | 158 |
| HumanEval+ | 1.77 s | 52.2 | 93 |
| IFEval | 5.46 s | 70.7 | 386 |
| MBPP+ | 3.73 s | 62.4 | 233 |
| MMLU-Pro | 2.74 s | 34.7 | 95 |
| Arena-Hard | 304.64 s | 38.7 | 11,792 |

</details>

These numbers are outright not impressive. The only of the 6 that are on-par with Qwen3.8-flash-next-nvfp4 is BFCL (Maya-M sits 1 percent higher). Every other value is notably behind. This suggests to me the aggressive quantization most likely hampers this model in all ways besides tool calls. These benchmarks aren't everything though. As I've seen in other benchmark sets, real world use often doesn't align.

### Word500

Back to [the puzzle benchmark](/blog/word500_benchmark/) - guess the five letter word given only the counts of letters in the right place, wrong place, or nowhere. Measures reasoning effectiveness and efficiency.

**Details:** 6 boards x 10 samples = 60 runs, temp 1.0 / top_p 0.95, `max_tokens: 64000`, concurrency 1, loop-abort at 10 consecutive repeats. Three boards (Smoke, Poker, Hoard) each run twice: once as a screenshot, once as text only.

{{< chart type="bar" height="340" >}}
{
  "labels": ["Smoke","Poker","Hoard","Smoke (text)","Poker (text)","Hoard (text)","Overall"],
  "datasets": [
    {"label":"Maya-M (IQ2_S)","data":[90,70,100,100,90,100,91.67],"backgroundColor":["#7c5cfcac","#ff6b9cac","#f5b73dac","#5cd6e0ac","#a99bf0ac","#ff8a5cac","#e8e8f0b3"],"borderColor":["#7c5cfc","#ff6b9c","#f5b73d","#5cd6e0","#a99bf0","#ff8a5c","#e8e8f0"],"borderWidth":2}
  ],
  "title": {"display":true,"text":"Maya-M (IQ2_S) · correct guesses (%)","font":{"size":13,"weight":600},"padding":{"top":2,"bottom":10}},
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
    {"label":"Maya-M (IQ2_S)","data":[13962,21021,18707,8912,23666,16498,17128],"backgroundColor":["#7c5cfcac","#ff6b9cac","#f5b73dac","#5cd6e0ac","#a99bf0ac","#ff8a5cac","#e8e8f0b3"],"borderColor":["#7c5cfc","#ff6b9c","#f5b73d","#5cd6e0","#a99bf0","#ff8a5c","#e8e8f0"],"borderWidth":2}
  ],
  "title": {"display":true,"text":"Maya-M (IQ2_S) · avg output tokens per run","font":{"size":13,"weight":600},"padding":{"top":2,"bottom":10}},
  "legend": {"display":false},
  "scales": {
    "y": {"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}},
    "x": {"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}}
  }
}
{{< /chart >}}

<details>
<summary><strong>📊 Expand Word500 Table</strong></summary>

| Board | Correct | Accuracy | Format ok | Avg tokens | Max tokens |
|---|---|---|---|---|---|
| Smoke | 9/10 | 90% | 0/10 | 13,962 | 33,040 |
| Poker | 7/10 | 70% | 2/10 | 21,021 | 32,780 |
| Hoard | 10/10 | 100% | 1/10 | 18,707 | 25,716 |
| Smoke (text) | 10/10 | 100% | 10/10 | 8,912 | 12,519 |
| Poker (text) | 9/10 | 90% | 10/10 | 23,666 | 32,791 |
| Hoard (text) | 10/10 | 100% | 10/10 | 16,498 | 32,784 |
| **overall** | **55/60** | **91.67%** | **33/60 (55%)** | **17,128** | **33,040** |

Overall token stats: total 1,027,653 · median 16,124 · min 5,444 · max 33,040. Two loop aborts (both on the Poker board), zero truncated answers.

</details>

Maya-M pulled off a big 55/60 correct result, which puts it on par with Qwen3.8-flash-next-nvfp4 (my benchmark leader) with a big caveat: the vision boards essentially never followed the single-word format (3 of 30). It consistently produced responses in the format of **ANSWER** [explanation]. I've actually only seen tiny models that outright can't handle the benchmark at all fail to format its answer correctly. Going further, the average token count of 17k is very good, also within error of our current leader's numbers.

It's important to observe there generall seems to be a reduction in capability when vision is involved. With just text boards provided, the model only missed one guess. Meanwhile in the vision-testing puzzles it missed 3 more. I would need to run a whole lot more reps to determine the significance, but with how long these runs take with this model thats not in the cards. Just consider, the mmproj might be a weaker avenue for this model.

## In-Harness Tests

Curated suites need something to anchor them to reality. These are the same in-harness jobs I ran in the [Swift1.5 NVFP4 comparison](/blog/swift1.5_nvidia_nvfp4_comparison/) (and Spark-X2.6 before that), so Maya-M lines up directly against the models in those entries.

### Open-WebUI Chat - Search, Reasoning, Function Calling

The same two-turn job:

1. Can you find a few recently released unified memory systems with 128gb+ ram and compare their prices/availability/pros and cons?
2. Can you format that information into a single page pdf so i can share it?

Same expectations as the prior entries: Nvidia RTX/DGX Spark, the M_ Ultra Mac Studios, the various Ryzen AI Max 395 mini pcs, MSRP, real prices, and pros/cons covering availability, memory size, bandwidth and compute. And of course it needs to find and call the PDF creation tool sitting in the harness.

#### Results

{{< model-report-tabs file="root:data/blog/project_maya_review/unified_memory_results.json" uid="umem" >}}

The cleanest result I've had with a model in this harness. Most expected contenders can get the search -> fetch tool pattern, fewer properly set the search result count, and not a single other has handled the task creation, update, and closure this well. Very impressed by the models behavior and results. The output is accurate to the requirements and formatted cleanly.

### Pelican on a Bicycle

The classic silly prompt, as always.

> Generate an SVG of a pelican riding a bicycle

{{< model-report-tabs file="root:data/blog/project_maya_review/pelican_results.json" kind="svg" uid="pelicans" >}}

Once again, killed it. This is the best pelican I've seen rendered in this test in my harness. Look at the tasteful thickness of the beak. The bicycle is perfectly designed. The layering with the leg behind the bike is incredible. You can compare it [here](/blog/q3.8fn_engine_comparison/#pelican-on-a-bicycle) to 3 different Qwen3.8-flash-next quants and [here](/blog/27bvs31bvs122b_benchmark/#pelican-on-a-bicycle) for another few (smaller) models that have done well.

### Plex recommendation app

In VScode + Cline - A big, messy, directionless 1-shot attempt at a sort of application I may employ the model to create:

> Create a docker compose compatible web app that users can log into with a Plex account to browse popular shows/movies and be given show/movie recommendations based on their watch history and ratings.

**First attempts:**

The model was able to almost reach a functional state with no input. The Plex login functionality worked, but upon load it suggested it had no TMDB API key despite me providing it in the .env. One quick prompt did clear that issue and get the primary browse page working.

<table style="width:100%; table-layout:fixed;">
<tr>
<th style="width:50%">Plex login</th>
<th style="width:50%">Main screen</th>
</tr>
<tr>
<td style="width:50%"><img src="figures/plex-login.png" alt="Maya-M build, Plex login" style="width:100%"></td>
<td style="width:50%"><img src="figures/plex-main-screen.png" alt="Maya-M build, main screen" style="width:100%"></td>
</tr>
</table>

**The TMDB key detour:**

<table style="width:100%; table-layout:fixed;">
<tr>
<td style="width:100%"><img src="figures/plex-tmdb-key-error.png" alt="Maya-M build, TMDB api key error popup" style="width:100%"></td>
</tr>
</table>

**Further refinement prompts:**

Despite the Browse page being functional, the For You was not. It simply couldn't pull watch history or ratings from Plex. It took a few back and forths including me providing a link to the Plex API documentation for the model to succeed at all. But once I did things looked great.

<table style="width:100%; table-layout:fixed;">
<tr>
<th style="width:33.33%">For You, failing</th>
<th style="width:33.33%">For You, fixed</th>
</tr>
<tr>
<td style="width:33.33%"><img src="figures/plex-for-you-failure.png" alt="Maya-M build, For You page failing to pull watch history" style="width:100%"></td>
<td style="width:33.33%"><img src="figures/plex-for-you-fixed-1.png" alt="Maya-M build, For You page after refinement 1" style="width:100%"></td>
<td style="width:33.33%"><img src="figures/plex-for-you-fixed-2.png" alt="Maya-M build, For You page after refinement 2" style="width:100%"></td>
</tr>
</table>

| | Maya-M |
|---|---|
| First response | Functional stack, good choice in TMDB integration. |
| Plex auth | built correctly; container starts and login works |
| TMDB key | popup claimed it was missing despite it sitting in the `.env` |
| Prompts to fix TMDB key | 1 |
| Watch history → recommendations | needed a few rounds of prompts plus links to the Plex API docs |
| 1-shot? | no |

Just like the qwen3.8-flash-next quants in the [Swift1.5 comparison](/blog/swift1.5_nvidia_nvfp4_comparison/), this problem is too much for a 1-shot for this model in this harness, but it is certainly within the realm of capable with a modicum of research and planning. I'd actually say I preferred both UIs created by Qwen3.8-flash-next in my prior test and liked how they both came up with a creative name.

### Designing a server case

In Hermes harness - This is another real world test that mirrors a project I've been working on - I've designed and built a new case for my LLM rig. Could it 1-shot a 3D representation of the efficient build I brainstormed over weeks? Probably not, but let's see what it output.

> Let's design a case for a server that supports standard ATX motherboard and power supply. It should support an RTX 6000 Blackwell and an Evga 3090 FTW3.
>
> The primary focus should be keeping the case compact and maximizing airflow.
>
> Your output should be a 3D representation of the case for easy viewing.

The viewer below is the real artifact, drag to orbit and scroll to zoom. Three.js, loaded from a CDN, in a self-contained page. Expand to load it.

<details>
<summary><strong>🖥 Maya-M build - dual-GPU ATX airflow case, 33.4 L (200 × 459 × 364 mm), interactive 3D</strong></summary>

<iframe src="/blog/project_maya_review/viewers/dual-gpu-airflow-case.html" loading="lazy" title="Maya-M build 3D case viewer" style="width:100%;height:1080px;border:1px solid #2a2a3a;border-radius:8px;background:#12161d"></iframe>

[Open full](/blog/project_maya_review/viewers/dual-gpu-airflow-case.html) &#8599;

</details>

- By far the best of the 3 models I've run this test on - the resulting model is extremely clear and could nearly actually be built.
- The design is a little confused about which side of the motherboard is the back, and where the fans should go.
- It made a big assumption that the motherboard PCIe spacing is large enough to leave a gap between the two GPUs - which is uncommon.
- Overall the model is clean, includes airflow, modifiable views, clean labels. Did mislabel the units on some measurements (feet vs in).

## ONE MILLION CONTEXT

One of the benefits I really didn't take advantage of with Maya + GLM-5.3-Flash is KV residing in RAM and the model's native 1M max context. I figured as a bonus I'd reconfigure to sample the performance at this increased value and test how well the system handles tossing the KV over PCIE.

{{< figure src="gui/1Mctx.png" width="100%" >}}

### 1M Speed

Same single stream sweep, this time with the served context raised to the model's native 1M. 512 tokens generated per run, prompt size walked from 1k out to `--context 1048576`. Two reps per point; the charts are the mean of reps.

{{< chart type="line" height="320" >}}
{
  "labels": ["1k","8k","32k","131k","262k","524k","1M"],
  "datasets": [
    {"label":"Maya-M (IQ2_S)","data":[1288,3379,3652,3535,3294,2884,2312],"borderColor":"#7c5cfc","backgroundColor":"rgba(124,92,252,0.10)","tension":0.25,"pointRadius":4}
  ],
  "title": {"display":true,"text":"Maya-M (IQ2_S) · prefill (tok/s)","font":{"size":13,"weight":600},"padding":{"top":2,"bottom":10}},
  "legend": {"display":false},
  "scales": {
    "y": {"min":0,"max":4200,"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}},
    "x": {"title":{"display":true,"text":"prompt size","color":"#9898a8"},"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}}
  }
}
{{< /chart >}}

{{< chart type="line" height="320" >}}
{
  "labels": ["1k","8k","32k","131k","262k","524k","1M"],
  "datasets": [
    {"label":"Maya-M (IQ2_S)","data":[76.2,68.0,67.7,63.3,59.8,54.5,46.8],"borderColor":"#5cd6e0","backgroundColor":"rgba(92,214,224,0.10)","tension":0.25,"pointRadius":4}
  ],
  "title": {"display":true,"text":"Maya-M (IQ2_S) · decode (tok/s)","font":{"size":13,"weight":600},"padding":{"top":2,"bottom":10}},
  "legend": {"display":false},
  "scales": {
    "y": {"min":0,"max":100,"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}},
    "x": {"title":{"display":true,"text":"prompt size","color":"#9898a8"},"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}}
  }
}
{{< /chart >}}

{{< chart type="line" height="300" >}}
{
  "labels": ["1k","8k","32k","131k","262k","524k","1M"],
  "datasets": [
    {"label":"Maya-M (IQ2_S)","data":[0.73,2.12,7.82,32.26,69.22,158.09,394.47],"borderColor":"#ff6b9c","backgroundColor":"rgba(255,107,156,0.10)","tension":0.25,"pointRadius":4}
  ],
  "title": {"display":true,"text":"Maya-M (IQ2_S) · time to first token (s)","font":{"size":13,"weight":600},"padding":{"top":2,"bottom":10}},
  "legend": {"display":false},
  "scales": {
    "y": {"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}},
    "x": {"title":{"display":true,"text":"prompt size","color":"#9898a8"},"ticks":{"color":"#9898a8"},"grid":{"color":"rgba(42,42,58,0.5)"}}
  }
}
{{< /chart >}}

<details>
<summary><strong>📊 Expand Speed Table</strong></summary>

Each row is the *mean of two reps*; the last two columns are the engine's own reported prefill/decode tok/s for comparison with the client-measured numbers:

| Prompt | Prompt tokens | TTFT | prefill tok/s | decode tok/s | srv prefill | srv decode |
|---|---|---|---|---|---|---|
| 1k | 944 | 0.73 s | 1,288 | 76.2 | 1,294 | 76.4 |
| 8k | 7,176 | 2.12 s | 3,379 | 68.0 | 3,484 | 68.2 |
| 32k | 28,546 | 7.82 s | 3,652 | 67.7 | 3,737 | 67.9 |
| 131k | 114,029 | 32.26 s | 3,535 | 63.3 | 3,585 | 63.5 |
| 262k | 228,004 | 69.22 s | 3,294 | 59.8 | 3,338 | 60.0 |
| 524k | 455,956 | 158.09 s | 2,884 | 54.5 | 2,917 | 54.6 |
| 1M | 911,859 | 394.47 s | 2,312 | 46.8 | 2,332 | 46.9 |

</details>

Even at 1M ctx this is genuinely usable. Sure you're waiting for 6.5min for your first token, but in situations where you truly need it the prefill and decode are still well within usable range. I'm impressed how well this holds up to a huge KV cache. There really isn't much downside to having this option as long as you have the spare RAM.

## Conclusion

{{< verdict >}}
<p class="verdict-lead">tl;dr</p>

- Speed is real. Maya does an excellent job finding the best configuration for your hardware.
- Quality does take a beating. The deep quant is not free, hamstringing benchmark performance, but in real use I couldn't feel it. Followed instructions and handled my tests in various harnesses as well or better than Qwen3.8-flash-next-nvfp4.
- Token-efficient, coding capable, and by my observation better at natural sounding prose.
- Speed scales well into the full 1M context supported by GLM-5.3-Flash

I do like how this model feels in the hand, but where I feel it the gap is only marginally better than my existing best-in-slot. The speed sacrifice on the other hand is substantial. What Maya is doing is notable, unlocking models for subpar hardware, but I still think a smaller model at a more reasonable quantization is the way to go.

If I find some time I may repeat the benchmarks with Maya-L (156GB), or try to get the engine to run a Q4_K_XL (200GB) gguf instead. The 156GB gguf would stress my ram a bit more, and the 200GB one would nearly max it but be in line with quality I'd actually like. I'd also like to try DSV4.1-Flash with the engine.

{{< /verdict >}}
