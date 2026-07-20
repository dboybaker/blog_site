---
title: "The Word500 Benchmark"
date: 2026-07-12T12:00:00Z
publishDate: 2026-07-12T12:00:00Z
draft: false
tags: ["llm", "llama.cpp", "vllm", "benchmark", "qwen", "gemma"]
summary: "An unassuming puzzle game that benchmarks reasoning efficiency well."
cardImage: "word500_blank.png"
---
{{< ctx-bar >}}
Tested in this article: Qwen3.6-27b Q4_K_XL (single 3090, kv cache Q4_0), Qwen3.6-27b Q6_K_XL, Qwen3.6-27b AutoRound INT4, Qwen3.6 35b Q6_K_XL, Gemma4:e2b/e4b/12b Q4_0_QAT (single 3090), Gemma4:31b Q4_0_QAT, Gemma4:26b Q8_0 
<span><strong>Hardware</strong> 2× RTX 3090 · 48 GB</span>
<span><strong>OS</strong> Debian 13</span>
<span><strong>Engines</strong> llama.cpp + vLLM</span>
{{< /ctx-bar >}}

## The Game

<img src="word500_blank.png" alt="Word500 Board">

A friend of mine introduced me to this Wordle-style puzzle: Word500. The goal of the puzzle is pretty simple in nature, but challenging to solve. You're given 8 chances to guess the mystery 5 letter word. After each guess, you're shown numbers to inform your next guesses:

- 🟩 **Green:** How many letters are correct AND in the exact right spot.
- 🟨 **Yellow:** How many letters are correct but in the WRONG spot.
- 🟥 **Red:** How many letters are completely incorrect.

Sometimes you'll guess a word that 3 letters in the right spot, but have no idea which those are. Other words will highlight all red, not a single letter correct. Those are my favorite, eliminating 5 letters from the pool in one go?? After playing a few rounds I realized if approached without much strategy, the final guess comes down to a massive process of elimination. You end up in situations like:

> I know three of the letters from "SPIDER" are in the word but don't know the order, I know it doesn't start with T, I know there's either a 'G' or an 'L' in the word. Could it be "DRIPS"? No, there are 4 letters matching with "SPIDER". "GLIDED" would work! Wait it couldn't fit since I'm on easy mode with no repeats. "GRIPES"? That checks out. That will be my next guess.

For anyone who has watched an LLM ``` <think> ``` stream, this might look pretty familiar. That realization led me to utilizing this puzzle as a nice tool to see how effectively a model thinks. Does it consider a word, rule it out, only to consider and rule it out again? Does it loop indefinitely, repeating the word "GHOST" for 30K tokens? Or does it effectively make and respect a thought, quickly working its way toward a good guess? Thus I present, the Word500 Benchmark.

## The Setup

**Prompt used:**

> I'm trying a puzzle game. The goal is to guess the 5 letter word. When you guess a word it tells you how many letters are correct and in the right spot (green number), how many letters are correct but in the wrong spot (yellow number), and how many letters are incorrect (red number). I'm playing on easy mode, no jqxz or repeat letters. I've used 7 of my 8 guesses. Based on this screenshot and the rules I provided can you try to guess the correct 5 letter word? 

<img src="word500.png" alt="Word500 Board State">

**The correct answer for this example was "SMOKE".**

> **Note:** Vision capability was required for all models in this test to process the board state.

## Results
*Model, run Pass/Fail and Output Token Count, Average Token Count*

| Model       | Run1  | Run2  | Run3  | Run4  |  Run5 | Avg |
|----------------------------|---|---|---|---|---|---|
| Qwen3.6-27b Q4_K_XL        | <span class="result-pass">Pass</span>/6,246  |  <span class="result-pass">Pass</span>/5,714 | <span class="result-pass">Pass</span>/14,443  | <span class="result-pass">Pass</span>/6,840  | <span class="result-pass">Pass</span>/4,090  |  7,467 |
| Qwen3.6-27b Q6_K_XL        |  <span class="result-pass">Pass</span>/8,401 | <span class="result-pass">Pass</span>/7,016  |  <span class="result-pass">Pass</span>/7,292 | <span class="result-pass">Pass</span>/10,177  | <span class="result-pass">Pass</span>/5,402  | 7,658  |
| Qwen3.6-27b AutoRound INT4 | <span class="result-pass">Pass</span>/28,403  | <span class="result-pass">Pass</span>/7,297  | <span class="result-pass">Pass</span>/16,600  | <span class="result-fail">Fail</span>/6,697  | <span class="result-pass">Pass</span>/5,911  |  12,982 |
| Qwen3.6 35b Q6_K_XL        |  <span class="result-dnf">DNF</span> |  <span class="result-dnf">DNF</span> |  <span class="result-dnf">DNF</span> |  <span class="result-dnf">DNF</span> |  <span class="result-dnf">DNF</span> |  <span class="result-dnf">DNF</span> |
| Gemma4:e2b Q4_0_QAT        | <span class="result-fail">Fail</span>/2,165  |  <span class="result-fail">Fail</span>/1,956 | <span class="result-fail">Fail</span>/2,026  | <span class="result-fail">Fail</span>/2,156  | <span class="result-fail">Fail</span>/2,430  | 2147  |
| Gemma4:e4b Q4_0_QAT        |  <span class="result-fail">Fail</span>/3,684 | <span class="result-fail">Fail</span>/3,780  | <span class="result-fail">Fail</span>/4,710  | <span class="result-fail">Fail</span>/2,484  | <span class="result-fail">Fail</span>/4,342  | 3800  |
| Gemma4:12b Q4_0_QAT        |  <span class="result-dnf">DNF</span> |  <span class="result-dnf">DNF</span> |  <span class="result-dnf">DNF</span> |  <span class="result-dnf">DNF</span> |  <span class="result-dnf">DNF</span> | <span class="result-dnf">DNF</span>  |
| Gemma4:31b Q4_0_QAT        |  <span class="result-pass">Pass</span>/3,426 |  <span class="result-pass">Pass</span>/4,456 |  <span class="result-pass">Pass</span>/3,352 | <span class="result-pass">Pass</span>/4,479  | <span class="result-pass">Pass</span>/4,334  |  4009 |
| Gemma4:26b Q8_0            | <span class="result-fail">Fail</span>/29,008  | <span class="result-pass">Pass</span>/9,801  | <span class="result-dnf">DNF</span>  |  <span class="result-dnf">DNF</span> |  <span class="result-fail">Fail</span>/34,723 | 24,511  |

<img src="word500_benchmark_averages_pass-fail.png" alt="Word500 Average Completion Tokens">

## Observations

- **Gemma4:31b** is the clear winner. It successfully guessed the correct word in every run and did so in the lowest total tokens by far.
- There appears to be some minimum parameter count that makes this task doable. The MoE models really struggled with looping and wrong answers.
- This analysis was purely focused on total tokens required, but with speed considered the results don't change. Gemma4:31b looks incredible.

### Speed Comparison

| Model                      | Avg Tokens | Decode Speed (Tps) | Time (s) |
|----------------------------|------------|--------------------|----------|
| Qwen3.6-27b Q4_K_XL        | 7,467      | 50                 | 149      |
| Qwen3.6-27b Q6_K_XL        | 7,658      | 70                 | 109      |
| Qwen3.6-27b AutoRound INT4 | 12,982     | 90                 | 144      |
| Gemma4:31b Q4_0_QAT        | 4009       | 110                | 36       |
| Gemma4:26b Q8_0            | 24,511     | 117                | 209      |

<img src="word500_benchmark_time.png" alt="Word500 Average Completion Time">

{{< verdict >}}
<p class="verdict-lead">Conclusion</p>
I was pretty surprised Qwen didn't take the victory here. I've grown so used to using it for everything as it does the best with chained tool calls, which most of my work requires. Gemma4 feels lazy, likes to do the bare minimum and decide its done calling tools. But when simply chatting, relying on the model's reasoning, Gemma4 feels unparalleled. It almost never hallucinates and, as is apparent in this test, thinks efficiently and effectively to reach a conclusion. I was also surprised the MoE models and Gemma4:12b failed so hard. It seems like this sort of reasoning requires some minimum amount of active parameters to persist. In a future test I would get a nice gradient of active parameters, starting at least with 14b and work my way up till I find the minimum viable parameter count. I'm sure plenty more factors come into play, but isolating that one element would be interesting.

{{< /verdict >}}

---

### Bonus Content


I also pulled and ran two large models outside of this benchmark effort and happened to run them against this query.

**Step3.7 Flash (201b, 11b active) at UD-Q3_K_XL** 
    -Passed the test, but used ~32k tokens and thus took around 30 minutes at the measly 17tps decode my system can muster

**MiMo-V2.5 (310b, 15b active) at UD-IQ3_XXS**
    -Was the only model to correctly guess the answer, then immediately for no reason at all decide that wasn't right and changed its final answer to an incorrect word. It did do so in the fewest tokens of any model, coming in at 2.6k. My gut tells me if I had the hardware this model would be incredible.

Running this against some frontier models was interesting for context as well:
- Gemini Flash Lite failed to get the right answer
- Gemini Flash successfully got it right in reasonable time
- Haiku 4.5 got the answer right after burning tokens for 10 minutes
- Sonnet 5 and Opus 4.8 nailed it as well, but slowly
- Fable was the only model to get the answer right faster than Gemma4-31b