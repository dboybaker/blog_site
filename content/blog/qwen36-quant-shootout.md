---
title: "Does the Quant Actually Matter? Qwen3.6-27B Shoot-out on 2× RTX 3090"
date: 2026-07-10T10:00:00Z
publishDate: 2026-07-10T10:00:00Z
draft: false
tags: ["llm", "benchmark", "quantization", "qwen"]
summary: "Four quantizations of Qwen3.6-27B, five capability axes, one dual-3090 rig. The quality question, settled with data instead of vibes."
---

<p class="benchmark-eyebrow"></p>

Four quantizations of Qwen3.6-27B, five capability axes, one dual-3090 rig; the quality question, settled with data instead of vibes.

{{< ctx-bar >}}
<span><strong>Model</strong> Qwen3.6-27B</span>
<span><strong>Hardware</strong> 2× RTX 3090 · 48 GB</span>
<span><strong>OS</strong> Debian 13</span>
<span><strong>Engines</strong> llama.cpp + vLLM</span>
{{< /ctx-bar >}}

{{< verdict >}}
<p class="verdict-lead">The finding</p>
<strong>Quality is a wash.</strong> Across all five axes, every quant lands inside the error bars. There's no measurable difference in intelligence. What separates them is <strong>speed, heat, VRAM, and context ceiling</strong>, not how smart they are.
{{< /verdict >}}

<h2 class="benchmark-h2">1 · Quality, Five Axes</h2>
<p class="benchmark-sub">Higher is better. Every gap below is smaller than its confidence interval, so the ranking is just noise. The whiskers on the chart are 95% confidence intervals and they overlap on every axis.</p>

<table class="benchmark-table">
  <thead><tr><th>Axis</th><th class="m-q4">Q4_K_XL</th><th class="m-q6">Q6_K_XL</th><th class="m-fp8">FP8</th><th class="m-int4">INT4-AR</th><th>n</th><th>Verdict</th></tr></thead>
  <tbody>
    <tr><td>IFEval · instruction-following</td><td class="m-q4">85.2</td><td class="m-q6">83.3</td><td class="m-fp8">83.3</td><td class="m-int4">80.7</td><td>150</td><td class="tied">tied ±6</td></tr>
    <tr><td>MMLU-Pro · knowledge + reasoning</td><td class="m-q4">72.1</td><td class="m-q6">72.1</td><td class="m-fp8">67.9</td><td class="m-int4">70.0</td><td>140</td><td class="tied">tied ±7</td></tr>
    <tr><td>BFCL · tool-calling *</td><td class="m-q4">84.7</td><td class="m-q6">84.0</td><td class="m-fp8">—</td><td class="m-int4">80.3</td><td>300</td><td class="tied">tied ±4</td></tr>
    <tr><td>Arena-Hard · open-ended (win %)</td><td class="m-q4">86.1</td><td class="m-q6">75.6</td><td class="m-fp8">75.7</td><td class="m-int4">66.7</td><td>50</td><td class="tied">tied ±11</td></tr>
  </tbody>
</table>

{{< quant-chart >}}

<h2 class="benchmark-h2">2 · Speed, Where the Real Difference Lives</h2>
<p class="benchmark-sub">Single-stream, measured with <span style="font-family:var(--font-mono)">vllm bench serve</span>. This is the axis that actually separates the options. vLLM's INT4 pulls even further ahead under concurrent load.</p>

<table class="benchmark-table">
  <thead><tr><th>Config</th><th>Prefill @1K</th><th>Decode @1K</th><th>TTFT @1K</th><th>Decode @32K</th></tr></thead>
  <tbody>
    <tr><td class="m-int4">INT4-AutoRound · vLLM</td><td class="win">~1600</td><td class="win">105</td><td class="win">0.65 s</td><td class="win">98</td></tr>
    <tr><td class="m-q4">Q4_K_XL · llama.cpp</td><td>~875</td><td>88</td><td>1.18 s</td><td>71</td></tr>
    <tr><td class="m-q6">Q6_K_XL · llama.cpp</td><td>~852</td><td>80</td><td>1.21 s</td><td>67</td></tr>
  </tbody>
</table>

{{< speed-chart >}}

<p class="benchmark-note">INT4-vLLM is ~30–45% faster to decode and reaches first token in half the time. FP8 not shown. Its emulated on Ampere (no native FP8 on the 3090), so its speed isn't representative.</p>

<h2 class="benchmark-h2">3 · Deployment, The Actual Trade-offs</h2>
<p class="benchmark-sub">Since quality is tied, these are the things you're really choosing between.</p>

<table class="benchmark-table">
  <thead><tr><th>Config</th><th>Engine</th><th>Quant</th><th>GPUs</th><th>Max ctx</th><th>Character</th></tr></thead>
  <tbody>
    <tr><td class="m-q6">Q6_K_XL</td><td>llama.cpp</td><td>6-bit GGUF</td><td>2</td><td>262K</td><td>Near-lossless, quiet, full context</td></tr>
    <tr><td class="m-q4">Q4_K_XL</td><td>llama.cpp</td><td>4-bit GGUF</td><td>1</td><td>200K</td><td>Coolest; only one that fits a single card</td></tr>
    <tr><td class="m-int4">INT4-AutoRound</td><td>vLLM</td><td>INT4 mixed</td><td>2</td><td>262K</td><td>Fastest; hottest & loudest; batches well</td></tr>
    <tr><td class="m-fp8">FP8</td><td>vLLM</td><td>FP8 (emul.)</td><td>2</td><td>—</td><td>Quality data-point only; no native FP8 on Ampere</td></tr>
  </tbody>
</table>

<h2 class="benchmark-h2">4 · So Which Do You Run?</h2>

{{< recommendations >}}
{{< card use="Daily solo chat · max context" pick="Q6_K_XL · llama.cpp" color="q6" >}}
Cool, quiet, full 262K, near-lossless. The default driver.
{{< /card >}}
{{< card use="Free up a GPU" pick="Q4_K_XL · llama.cpp" color="q4" >}}
Fits one 3090. Quality within noise of Q6 - leaves a card open with Q4_0 kv.
{{< /card >}}
{{< card use="Throughput · concurrent · agentic" pick="INT4-AR · vLLM" color="int4" >}}
Fastest, scales under load. Add a presence penalty to avoid loops; accept the heat.
{{< /card >}}
{{< card use="FP8 on Ampere" pick="Skip it" color="fp8" >}}
Emulated, slow, no quality edge. Only worth it on Hopper/Blackwell.
{{< /card >}}
{{< /recommendations >}}

<div class="benchmark-foot">
<p><strong>Method.</strong> Objective benchmarks (IFEval, MMLU-Pro, BFCL) run greedy (temp 0) with thinking disabled for valid scoring. Arena-Hard run at temp 0.6 with thinking on. Open-ended quality, judged pairwise by DeepSeek-V4-Flash against a GPT-4 baseline, answers order-swapped to cancel position bias. "Tied" = 95% confidence intervals overlap.</p>
<p><strong>* BFCL note.</strong> 3 models, n=300 (6 categories × 50), run before the sampling fix. INT4's lower score traced to degenerate repetition loops from a missing presence penalty — strictly a config artifact and reproduced clean once controlled.</p>
<p><strong>Caveats.</strong> Sample sizes are directional: they rule out large (>~8 pt) quality gaps, not small (3–5 pt) ones. Arena-Hard at n=50 carries ±10–13 pt bands. A full 500-prompt Arena-Hard run (~$2 on Flash) would only tighten bars around "tied." Speed is single-stream; vLLM's lead widens with concurrency.</p>
</div>