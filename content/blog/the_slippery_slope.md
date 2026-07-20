---
title: "The Slippery Slope"
date: 2026-07-07T12:00:00Z
publishDate: 2026-07-07T12:00:00Z
draft: false
tags: ["llm", "ollama", "getting-started"]
summary: "From a simple Ollama container to a dual-RTX 3090 workstation. A weekend experiment to a local LLM obsession."
---
{{< ctx-bar >}}
It started out with llama3.1:8b, how did it end up like this?
{{< /ctx-bar >}}

## The Beginning

Sunday, May 18th 2025 was the beginning of the end. I'd made my way through all the typical self-hosted services and then some. Nextcloud replaced Google Drive, Immich became the home for photos, and Plex even stepped up to serve a backup of my extensive Blu-Ray Disc collection. I was thriving as the sys ad for my friends and family who I managed to wrangle/onboard. I heard whispers of LLMs running on local hardware and as so many do, ended up spinning up an Ollama/Open-Webui Docker stack.

I had recently upgraded my Nab6 Lite mini pc to 64gb ram. I knew LLMs were **L**arge and used a lot of ram, but knew oh so little about the metrics that impacted their performance. I hit my first ``` ollama pull ``` & ``` run ``` and was made painfully aware of how far from both competency and minimum hardware requirements I was. Response crawled with single digit prefill and decode (terms I couldn't define given the context). I pivoted smaller, Gemma3:1b. To my surprise it performed reasonably in both speed and simple chat, but overall it was not enough. It only served to stoke the fire of what was to come.

## The First Benchmark

My first benchmark was a disorganized and poorly documented simple prompt:

> what is the best llm to run right now with Ollama on a server with an i5-12600h, 64gb ram, and no gpu? I just want to do general chat and ask it questions regarding my home server projects.

then a follow up

> help me set up Ollama with docker compose and a webui to run the [Insert Model] model you just suggested

I tried **Llama3.1-8B**, **Gemma3-4B**, and **Gemma3-1B**

- **Llama-8B** took a long time, but as far as I could tell the compose was 100% correct. It did try to tell me to get a .gguf from Huggingface without any details regarding the required conversion for Ollama.
- **Gemma-4B** was notably faster, selected a valid docker image, gave a functional looking docker compose, and suggested a real model but entirely ignored the webui desire. The commands it said to run after would not work unless you had prior knowledge of where to run them.
- **Gemma-1B** was snappy, but fully hallucinated the docker image. It seemed to mix the concept of docker image and language model. The deepest failure.

These three gave me a point of reference and I had to experience better. I spent the next day loading various models into my 1080ti, 16gb ddr4 SFF PC and my 3080ti, 96gb DDR5 gaming/workstation machine. I benched things as best I could with the limited knowledge I had. Qwen3-14b split across my 1080ti and ram, but still output faster than I could read. Llama 3.1 70b on the workstation lived mostly on CPU and output a token every 2 seconds.
Llama 3.1 8b cruised 100% GPU on either and output paragraphs per second. Regardless which model I ran, I wasn't impressed enough with the output quality to feel I could yet replace my Gemini Pro subscription, at least with any hardware within my grasp. The knowledge and resources gap was apparent and I decided to shelve the experiment. I'd check back in occasionally and make a decision when my 1 free year of Gemini ended.

## The Slow Burn

Various models proved interesting over time, mostly educationally. GPT OSS 120b demonstrated the benefits of MoE architecture as it ran only slightly slower than reading pace on my workstation despite an 86:14 CPU:GPU split at Q4_0. Qwen3.5-9b was ALMOST good enough at tool calling and chat to be useful at pace. Gemma3-12b really felt like chatting with something intelligent. It was around this point that my year was up and I started to imagine *what if I built a machine specifically for this*? I kept that idea on the backburner and continued experimenting with capabilities in my existing ecosystem. One front that was genuinely impressive was image generation. I had Z-Image-Turbo creating prompt-accurate realistic images in a way I did not think my workstation would be able to run.

## The Point of No Return

Then came Gemma4. No model family before it had pushed me to make a change like Gemma4 did. I finally dropped Ollama for Llama.cpp, as Ollama was taking too long to support it. I installed linux on my SFF PC to give myself a dedicated machine to free up workstation resources. For the first time, I genuinely started contemplating how I could best serve models locally. What would the software stack look like and what would be the hardware sweet spot? Even on a 1080ti e4b was fast, seemed to truly know its limitations, and was decent at tool calling. The timing couldn't have been better, it was really looking like my frontier subscription could be replaced for most of my use cases. Just as I was settling in, Qwen3.6 showed up to challenge Gemma for the crown. It was time to improve my hardware.

The chain of events looked something like this:

- "lets just get a bigger case, a used RTX 3060 12GB, and pair it with the 1080ti! Surely 23gb VRAM will suffice"
- "You know, a 3090 would give me 35GB, letting me run these 26-35b models nicely..."
- "but the 1080ti is too old, it can't do Flash Attention... I guess I'll replace it with a 5060ti 16gb. The extra 5gb VRAM will be great and the used price isn't too bad"

Soon I found myself with two RTX 3090s, 96gb ddr4, and the ability to run Qwen3.6-27b Q8 at nearly full context across both cards.

## Welcome to the Blog

In the time since I've experimented with various models and quantizations, playing with speed, tool calling capabilities, and benchmarking results. I spend dramatically more time tinkering than actually using models. I'm constantly reminded of the power tools I bought to build a space in my home to store power tools. At least I've reached a point of stability and can finally dig in to unlock the capabilities of a reasonable self hosted LLM rig (at least until I convince myself to spend $40k+ on hardware to cross the chasm to the next tier of models)

This blog will serve as a dumping ground for write ups related to my findings and experiments. Maybe it will help someone else, or maybe it will just prove to be long memory for me to nostalgia over my naivety. Either way, thanks for reading. I hope you find something useful or interesting.

Demietrich

<div class="image-grid">
  <img src="PXL_20260712_192358095_preview.jpeg" alt="LLM PC Build - Top View">
  <img src="PXL_20260712_192415239_preview.jpeg" alt="LLM PC Build - Topless">
</div>
