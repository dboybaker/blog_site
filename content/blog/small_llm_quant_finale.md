---
title: "Small LLM Finale - Q8_0"
date: 2026-09-14T12:00:00Z
publishDate: 2026-09-14T12:00:00Z
draft: false
tags: ["llm", "llama.cpp", "benchmark", "small-models"]
summary: "One final layer of tests to crown the best small LLM."
cardImage: "card-image.png"
---

{{< ctx-bar >}}
<span><strong>Tested in this article: </strong> Nanbeige4.2-3B-Q8, Spark-X2.5-4B-Q8, Ling-3.0-tiny-Q8 (BONUS - Spark-X2.5-1.7B-Q8)</span>

<span><strong>Hardware:</strong> RTX 6000 Blackwell · 96 GB VRAM, 96 GB DDR4  </span>
<span><strong>OS:</strong> Debian 13  </span>
<span><strong>Engine:</strong> llama.cpp </span>
<span><strong>Benchmarks:</strong> BFCL v4, MMLU-Pro, IFEval, Arena-Hard, HumanEval+, MBPP+, (+ Pelican)</span>
{{< /ctx-bar >}}

<details>
<summary><strong>📊 Expand Model llama-server Config</strong></summary>

```yaml
  Spark-X2.5-1.7B-Q8:
    ttl: 300
    healthCheckTimeout: 600
    cmd: >
      /usr/local/bin/llama-server
      --port ${PORT}
      --model /models/Spark-X2.5/1.7B/Spark-X2.5-1.7B-Q8_0.gguf
      --ctx-size 131072
      -ngl 99
      --main-gpu 0
      --split-mode none
      --fit off
      --flash-attn on
      --temp 1.0 --top-p 0.95 --top-k 0
      --jinja
      --parallel 1
      --batch-size 4096
      --ubatch-size 2048
```

```yaml
  Spark-X2.5-4B-Q8:
    ttl: 300
    healthCheckTimeout: 600
    cmd: >
      /usr/local/bin/llama-server
      --port ${PORT}
      --model /models/Spark-X2.5/4B/Spark-X2.5-4B-Q8_0.gguf
      --ctx-size 131072
      -ngl 99
      --main-gpu 0
      --split-mode none
      --fit off
      --flash-attn on
      --temp 1.0 --top-p 0.95 --top-k 0
      --jinja
      --parallel 1
      --batch-size 4096
      --ubatch-size 2048
```

```yaml
  Ling-3.0-tiny-Q8:
    ttl: 300
    cmd: >
      /usr/local/bin/llama-server
      --port ${PORT}
      --model /models/Ling-3.0-tiny/Ling-3.0-tiny-Q8_0.gguf
      --ctx-size 131072
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

```yaml
  Nanbeige4.2-3B-Q8:
    ttl: 300
    healthCheckTimeout: 600
    cmd: >
      /usr/local/bin/llama-server
      --port ${PORT}
      --model /models/nanbeige4.2-3B/Nanbeige_Nanbeige4.2-3B-Q8_0.gguf
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

{{< figure src="intro_image.jpg" width="70%" >}}

## Intro

This is a follow-up to my [previous entry regarding small LLMs](/blog/small_llm_shootout/). I'm looking for the best current option for a small model that could run fast in a secondary gpu for light tasks like title generation, media recs, simple documents, and calorie tracking. Tool calling and general behavior in my harness is the most important feature. Before I didn't worry about quantization, I compared the models in BF16. This time I grabbed the Q8_0 quants to see how they compare in that condition and select the best option. The three primary contenders here are
- Nanbeige4.2-3B-Q8 (the current leader)
- Spark-X2.5-4B-Q8
- Ling-3.0-tiny-Q8

I've also included Spark-X2.5-1.7B-Q8 as the previous benchmarks seemed to display a much larger gap than expected between it and the other models. I wanted to give it another shake as some bonus content, maybe my parameters were off when it was run in vLLM or something.

## Speed & Size

Once again model speed isn't super important at this size, but I decided it's an easy start. I had some anomalies in my speed results last time, so I went ahead and manually set a seed for each run and ensured a manual warmup before the measurements were taken. These seemed to normalize the results from before so now we have a more conclusive table. 

| Model | Decode (tok/s) | Prefill (tok/s) | Size in VRAM (Gib) @ 131k Ctx |
|---|---|---| ---|
| [Spark-X2.5-1.7B (1.7B)](https://huggingface.co/XHToken/Spark-X2.5-1.7B-GGUF) | ~323 | ~33.6k | 4.984 |
| [Nanbeige4.2-3B (3B)](https://huggingface.co/bartowski/Nanbeige_Nanbeige4.2-3B-GGUF) | ~146 | ~9.1k | 27.730 |
| [Spark-X2.5-4B (4B)](https://huggingface.co/XHToken/Spark-X2.5-4B-GGUF) | ~196 | ~17.5k | 10.476 |
| [Ling-3.0-tiny (7.9B MoE, 1.3B active)](https://huggingface.co/bartowski/Ling-3.0-tiny-GGUF) | ~325 | ~23.3k | 10.030 |

<details>
<summary><strong>📊 Speed Test Config</strong></summary>

```sh
vllm bench serve \
  --backend openai \
  --base-url http://127.0.0.1:8500 \
  --endpoint /v1/completions \
  --model {model} \
  --tokenizer /models/{model}/{tokenizer} \
  --trust-remote-code \
  --dataset-name random \
  --random-input-len 8192 \
  --random-output-len 128 \
  --random-prefix-len 0 \
  --num-prompts 20 \
  --max-concurrency 1 \
  --ignore-eos \
  --percentile-metrics ttft,tpot,itl \
  --seed {seed}
```
</details>

It was cool to compare the prefill on vLLM with the SparkX2.5 models and see the notable performance gap in measurements. Nothing surprising there, just neat to see. Nanbeige4.2 really falls behind in both prefill and decode, which makes sense since it does more than one pass over its 22 layers. It's more akin to a model twice its size. It is also HUGE in VRAM with any reasonable amount of context as the KV/state cost grows linearly per loop. Somewhat nullifies it in the small model category. To set it on-par with the others with less dense attention you'd have to drop it to around 32k ctx, a pretty far fall from the others at 131k.

## Traditional Benchmarks
*note these are not comparable to leaderboards - different sample size, different Arena Hard judge.*

### BFCL v4 - Tool Calling

**Details:** 50 samples, 6 test subsets → 300 samples total

![BFCL v4 — Overall Accuracy](/blog/small-llm-quant-finale/bfcl_v4_overall.png)

<details>
<summary><strong>📊 Expand Data Tables</strong></summary>

#### Overall Accuracy

| Model | Score | Samples | Latency (s) |
|---|---|---|---|
| Spark-X2.5-1.7B-Q8 (1.7B) | 59.7% | 300 | 2.07 |
| Nanbeige4.2-3B-Q8 (3B) | 80.7% | 300 | 1.51 |
| Spark-X2.5-4B-Q8 (4B) | 76.7% | 300 | 3.40 |
| Ling-3.0-tiny-Q8 (7.9B MoE, 1.3B active) | 77.3% | 300 | 1.15 |


#### By Subset

![BFCL v4 — By Subset](/blog/small-llm-quant-finale/bfcl_v4_subsets.png)

| Subset | Spark-X2.5-1.7B-Q8 | Nanbeige4.2-3B-Q8 | Spark-X2.5-4B-Q8 | Ling-3.0-tiny-Q8 |
|---|---|---|---|---|
| Simple Python | 56.0% | 96.0% | 96.0% | 96.0% |
| Multiple | 80.0% | 92.0% | 86.0% | 88.0% |
| Parallel | 66.0% | 90.0% | 90.0% | 86.0% |
| Multi-Turn Base | 24.0% | 48.0% | 34.0% | 48.0% |
| Live Multiple | 48.0% | 80.0% | 66.0% | 74.0% |
| Irrelevance | 84.0% | 78.0% | 88.0% | 72.0% |

</details>

### IFEval - Instruction-Following

**Details:** 250 samples

![IFEval — Instruction Following](/blog/small-llm-quant-finale/ifeval.png)

<details>
<summary><strong>📊 Expand Data Tables</strong></summary>

| Model | Prompt-level (strict) | Instruction-level (strict) | Prompt-level (loose) | Instruction-level (loose) | Samples |
|---|---|---|---|---|---|
| Spark-X2.5-1.7B-Q8 (1.7B) | 70.0% | 80.3% | 72.4% | 81.9% | 250 |
| Nanbeige4.2-3B-Q8 (3B) | 74.4% | 81.2% | 80.0% | 85.9% | 250 |
| Spark-X2.5-4B-Q8 (4B) | 79.2% | 86.1% | 80.8% | 87.5% | 250 |
| Ling-3.0-tiny-Q8 (7.9B MoE, 1.3B active) | 73.2% | 83.3% | 76.4% | 84.9% | 250 |

</details>

### MMLU-Pro - Reasoning

**Details:** 30 samples, 14 categories → 420 samples total

![MMLU-Pro — Overall Accuracy](/blog/small-llm-quant-finale/mmlu_pro_overall.png)

<details>
<summary><strong>📊 Expand Data Tables</strong></summary>

#### Overall Scores

| Model | Score | Samples | Latency (s) |
|---|---|---|---|
| Spark-X2.5-1.7B-Q8 (1.7B) | 48.3% | 420 | 13.28 |
| Nanbeige4.2-3B-Q8 (3B) | 67.9% | 420 | 6.53 |
| Spark-X2.5-4B-Q8 (4B) | 64.3% | 420 | 10.45 |
| Ling-3.0-tiny-Q8 (7.9B MoE, 1.3B active) | 57.4% | 420 | 5.37 |

#### By Category

![MMLU-Pro — By Category](/blog/small-llm-quant-finale/mmlu_pro_categories.png)

| Category | Spark-X2.5-1.7B-Q8 | Nanbeige4.2-3B-Q8 | Spark-X2.5-4B-Q8 | Ling-3.0-tiny-Q8 |
|---|---|---|---|---|
| Computer Science | 60.0% | 80.0% | 80.0% | 60.0% |
| Math | 80.0% | 80.0% | 90.0% | 86.7% |
| Chemistry | 66.7% | 76.7% | 83.3% | 70.0% |
| Engineering | 33.3% | 70.0% | 66.7% | 40.0% |
| Law | 46.7% | 43.3% | 33.3% | 36.7% |
| Biology | 60.0% | 83.3% | 80.0% | 76.7% |
| Health | 36.7% | 63.3% | 53.3% | 56.7% |
| Physics | 56.7% | 80.0% | 83.3% | 76.7% |
| Business | 53.3% | 63.3% | 73.3% | 63.3% |
| Philosophy | 33.3% | 63.3% | 50.0% | 43.3% |
| Economics | 43.3% | 73.3% | 66.7% | 53.3% |
| Other | 40.0% | 60.0% | 46.7% | 40.0% |
| Psychology | 36.7% | 73.3% | 50.0% | 70.0% |
| History | 30.0% | 40.0% | 43.3% | 30.0% |

</details>

### Arena-Hard - Reasoning

**Details:** 75 samples, run with `--repeat-penalty 1.1 --min-p 0.05`, judged by DeepSeek V4 Flash 0731

![Arena-Hard — Win Rate](/blog/small-llm-quant-finale/arena_hard.png)

<details>
<summary><strong>📊 Expand Data Tables</strong></summary>

| Model | Win Rate | Samples | Avg Output Tokens |
|---|---|---|---|
| Spark-X2.5-1.7B-Q8 (1.7B) | 27.0% | 75 | 23,051.8 |
| Nanbeige4.2-3B-Q8 (3B) | 81.9% | 75 | 6,275.3 |
| Spark-X2.5-4B-Q8 (4B) | 60.0% | 75 | 18,398.5 |
| Ling-3.0-tiny-Q8 (7.9B MoE, 1.3B active) | 55.1% | 75 | 14,517.9 |

</details>

### HumanEval+ & MBPP+ - Coding

**Details:** One pass each
- **HumanEval+:** 164 problems
- **MBPP+:** 378 problems

![HumanEval+ — pass@1 (164 problems)](/blog/small-llm-quant-finale/humaneval_plus.png)

![MBPP+ — pass@1 (378 problems)](/blog/small-llm-quant-finale/mbpp_plus.png)

<details>
<summary><strong>📊 Expand Data Tables</strong></summary>

#### Combined Comparison

| Model | HumanEval+ pass@1 | MBPP+ pass@1 |
|---|---|---|
| Spark-X2.5-1.7B-Q8 (1.7B) | 42.1% | 66.4% |
| Nanbeige4.2-3B-Q8 (3B) | 72.0% | 84.7% |
| Spark-X2.5-4B-Q8 (4B) | 72.6% | 83.3% |
| Ling-3.0-tiny-Q8 (7.9B MoE, 1.3B active) | 75.6% | 84.1% |

#### HumanEval+ — pass@1 (164 problems)

| Model | pass@1 | Samples | Latency (s) | Avg Output Tokens | Output (tok/s) |
|---|---|---|---|---|---|
| Spark-X2.5-1.7B-Q8 (1.7B) | 42.1% | 164 | 1.34 | 407.8 | 304.1 |
| Nanbeige4.2-3B-Q8 (3B) | 72.0% | 164 | 4.58 | 509.8 | 111.4 |
| Spark-X2.5-4B-Q8 (4B) | 72.6% | 164 | 1.81 | 331.7 | 183.2 |
| Ling-3.0-tiny-Q8 (7.9B MoE, 1.3B active) | 75.6% | 164 | 1.33 | 365.1 | 275.5 |

#### MBPP+ — pass@1 (378 problems)

| Model | pass@1 | Samples | Latency (s) | Avg Output Tokens | Output (tok/s) |
|---|---|---|---|---|---|
| Spark-X2.5-1.7B-Q8 (1.7B) | 66.4% | 378 | 3.94 | 925.4 | 234.8 |
| Nanbeige4.2-3B-Q8 (3B) | 84.7% | 378 | 7.78 | 895.0 | 115.0 |
| Spark-X2.5-4B-Q8 (4B) | 83.3% | 378 | 7.45 | 1,140.9 | 153.1 |
| Ling-3.0-tiny-Q8 (7.9B MoE, 1.3B active) | 84.1% | 378 | 1.45 | 403.5 | 279.2 |

</details>

## Quantization Comparison

Since my [previous entry](/blog/small_llm_shootout/) contained the same benchmarks against the BF16 weights for these models, I figured its worth putting the results side by side. The faded hatched bars represent the BF16 results and the solid bars are the results from the Q8 runs here. 

![BF16 vs Q8_0 — Traditional Benchmarks](/blog/small-llm-quant-finale/quant_comparison.png)

A genuinely clearer and more honest presentation is simply the gap between the two overlayed onto the 95% confidence interval.

![What Q8_0 Actually Changed](/blog/small-llm-quant-finale/quant_delta.png)

This very clearly displays none of the differences exceed error margin. Dropping to Q8 really does lose nothing visible in benchmarks. The expected result, but good to see clearly first hand. The more important focus is how each behaves in real world, in-harness use.

## Unstructured / Personal Tests

### Open-WebUI Chat - Search, Reasoning, Function Calling

I primarily use Open-WebUI for my LLM chat needs. This test is set up to see how well the model fares in my harness. Can it obey the system prompt and follow the user prompt? Can it properly assess available tools, format the calls, and handle errors? 

>1. Can you find a few recently released unified memory systems with 128gb+ ram and compare their prices/availability/pros and cons?
>2. Can you format that information into a single page pdf so i can share it?

I'm expecting to see 
- information about Nvidia RTX/DGX spark, existing and upcoming M# Ultra Mac Studios, and some of the various Ryzen AI Max 395 mini pcs.
- MSRP, but would love to see a model identify how much prices have increased. 
- pros and cons discussing availability, memory size, memory bandwidth, and compute.
- these models to be able to find and call the PDF creation tools present in the harness easily.

#### Results

{{< model-report-tabs file="small_llm_quant_finale/chat_results.json" >}}

I was really surprised to see that none of the models adhered to the single page instruction. Before, Nanbeige4.2 had clutched it but it fell through this time. Regardless, Nanbeige4.2 still followed more of the instructions than the other models. It obeyed the system prompt and determined the best `N` value for search query result count. The others simply defaulted to 5 or 10 per search.

I went ahead and messed around a bit with the specific wording of my prompt. I was curious if "single page pdf" comes across as "single pdf". I tried "single-page pdf" and saw the same multi-page productions, but then I tried "1-page pdf" and started seeing adherence. Each model generated a one pager when provided that revised prompt. Goes to show that small LLMs have not yet reached the language comprehension bigger ones have (and they're certainly nowhere near the "read your mind" style of frontier).

### Pelican on a Bicycle

You already know whats goin on here, benchmarks but silly.

> Generate an SVG of a pelican riding a bicycle

{{< model-report-tabs file="small_llm_quant_finale/pelican_results.json" kind="svg" uid="pelicans" >}}

Just like last time, no genuinely GOOD results, but I would be pretty confident in saying that Nanbeige generated the best of the group. There is an identifiable bird with a large beak, two spoked wheels, and some kinda frame. I'd give Ling3.0 Tiny the runner up with its bird that looks like its currently mid-crash. This test clearly is not great for this tier of model, but lets be real its not great for any tier of model. Its just fun.

## Conclusion

{{< verdict >}}
<p class="verdict-lead">tl;dr</p>

- Its pretty clear from the benchmarks, Nanbeige4.2-3B has quite a lead over these other models. Its biggest gaps were actually in part due to brevity. Other models were more likely to hit context limits, but even with those in consideration the ranking doesn't change.
- Its slightly less clear in the real world test, as the only difference was small sys-prompt adherence strength. The actual results didn't vary much.
- Being forced to limit the num_ctx to 32k or pulling an even lower quant to get this model close to the size of the others feels limiting, but in my particular use-case this is okay. The tasks I'd use it for don't require long context. This combined with the model's tendancy toward brevity make it a perfect fit.
- Models at this size still require very intentional wording.
- I was also honestly shocked at how well Spark-X2.5-1.7B-Q8 fared in-harness. It still got crushed in the benchmarks and really struggled with back and forth chaotic tool calling, but in the end it was able to generate a valid PDF. The results also close the book on the validity of the benchmark gap. Its most likely real.

I'll have one last test of Nanbeige4.2-Q4_K_M to see if I can get away with the smaller quant, but Nanbeige4.2-3B walks away the selected champion of this gauntlet.

{{< /verdict >}}

