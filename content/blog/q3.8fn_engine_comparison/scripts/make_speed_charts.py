#!/usr/bin/env python3
"""Prefill / decode / TTFT / memory charts from results/speed_bench.csv.

Single-stream sweep: 5 prompt lengths, 512 generated tokens, 2 reps per cell.
Titles live in the Markdown figure captions, so they are not baked into the PNGs.
"""
import csv
import os
import statistics as st
import sys

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HERE = os.path.dirname(os.path.abspath(__file__))
CSV = os.path.join(os.path.dirname(HERE), 'results', 'speed_bench.csv')

SLOTS = ['Ninfer6000', 'vLLM NVFP4', 'llama.cpp Q4_K_XL']
LABELS = ['Ninfer6000 (nvfp4)', 'vLLM (nvfp4)', 'llama.cpp (Q4_K_XL)']
COLORS = ['#d2a8ff', '#58a6ff', '#f0883e']
NAME = {'qwen3.8-flash-next-ninfer6000': 'Ninfer6000',
        'qwen3.8-flash-next-nvfp4': 'vLLM NVFP4',
        'Qwen3.8-Flash-Next-UD-Q4_K_XL': 'llama.cpp Q4_K_XL'}
CTX = [1024, 8192, 32768, 65536, 131072]
BANDS = ['~1k', '7.2k', '28.6k', '57.1k', '114.1k']

BG, TITLE, LABEL, GRID, SPINE, TEXT = ('#0d1117', '#58a6ff', '#c9d1d9', '#21262d',
                                       '#30363d', '#c9d1d9')
plt.rcParams.update({
    'figure.facecolor': BG, 'axes.facecolor': BG, 'savefig.facecolor': BG,
    'axes.edgecolor': SPINE, 'axes.labelcolor': LABEL, 'xtick.color': LABEL,
    'ytick.color': LABEL, 'text.color': TEXT, 'font.size': 13,
    'axes.grid': True, 'grid.color': GRID, 'grid.linewidth': 0.8})


def style_ax(ax, ylabel=None, y_pad=1.14, floor=0.0):
    ax.set_axisbelow(True)
    ax.grid(True, which='major', axis='y', color=GRID, linewidth=0.8)
    ax.grid(False, which='major', axis='x')
    for side in ('top', 'right'):
        ax.spines[side].set_visible(False)
    for side in ('left', 'bottom'):
        ax.spines[side].set_color(SPINE)
    ax.tick_params(colors=LABEL, length=0)
    if ylabel:
        ax.set_ylabel(ylabel)
    ymin, ymax = ax.get_ylim()
    ax.set_ylim(floor, ymax * y_pad)


def load():
    rows = list(csv.DictReader(open(CSV)))
    acc, meta = {}, {}
    for r in rows:
        m, c = NAME[r['model']], int(r['ctx'])
        d = acc.setdefault(m, {}).setdefault(c, {})
        for k, key in (('ttft_s', 'ttft'), ('prefill_tps', 'prefill'),
                       ('decode_tps', 'decode'), ('srv_prefill_tps', 'srv_prefill'),
                       ('srv_decode_tps', 'srv_decode')):
            if r.get(k):
                d.setdefault(key, []).append(float(r[k]))
        meta[m] = dict(load=float(r['load_s']), vram_load=float(r['vram_loaded_gib']),
                       vram_peak=float(r['vram_peak_gib']), ram_load=float(r['ram_loaded_gib']),
                       ram_peak=float(r['ram_peak_gib']), cache_peak=float(r['cache_peak_gib']),
                       gpu_rss=float(r['gpu_proc_rss_peak_gib']))
    out = {}
    for m, byc in acc.items():
        out[m] = {c: {k: st.mean(v) for k, v in d.items()} for c, d in byc.items()}
    return out, meta


def line_chart(path, metric, ylabel, fmt, floor=0.0, y_pad=1.20, offsets=None,
               logy=False):
    data, _ = load()
    fig, ax = plt.subplots(figsize=(12.6, 7), dpi=100)
    x = np.arange(len(CTX))
    for i, m in enumerate(SLOTS):
        ys = [data[m][c][metric] for c in CTX]
        ax.plot(x, ys, color=COLORS[i], lw=2.6, marker='o', ms=8, label=LABELS[i],
                zorder=3 + i)
        dx, dy = (offsets or {}).get(i, (0, 11))
        for xi, yi in zip(x, ys):
            ax.annotate(fmt.format(yi), (xi, yi), textcoords='offset points',
                        xytext=(dx, dy), ha='center', fontsize=11.5, color='#e6edf3',
                        fontweight='bold')
    ax.set_xticks(list(x))
    ax.set_xticklabels(BANDS, fontsize=14)
    ax.set_xlabel('prompt tokens (measured)', fontsize=13)
    if logy:
        lo = min(data[m][c][metric] for m in SLOTS for c in CTX)
        hi = max(data[m][c][metric] for m in SLOTS for c in CTX)
        ax.set_yscale('log')
        ax.set_ylim(lo / 2.5, hi * 2.2)
        ax.set_yticks([0.1, 0.3, 1, 3, 10, 30])
        ax.set_yticklabels(['0.1', '0.3', '1', '3', '10', '30'])
        ax.minorticks_off()
    else:
        style_ax(ax, ylabel, y_pad, floor)
        ax.set_xlabel('')
    ax.set_xlabel('prompt length (tokens)', fontsize=13)
    if ylabel:
        ax.set_ylabel(ylabel)
    ax.legend(loc='upper left', bbox_to_anchor=(0.0, 1.0), ncol=3, fontsize=12,
              frameon=True, facecolor='#161b22', edgecolor='#30363d', labelcolor=LABEL)
    fig.tight_layout()
    fig.savefig(os.path.join(OUT, path), facecolor=BG, bbox_inches='tight')
    plt.close(fig)


def memory_chart():
    _, meta = load()
    groups = ['VRAM loaded', 'VRAM peak', 'RAM loaded', 'RAM peak',
              'GPU proc RSS', 'Weights on disk']
    keys = ['vram_load', 'vram_peak', 'ram_load', 'ram_peak', 'gpu_rss', 'cache_peak']
    n, m = len(groups), len(SLOTS)
    x = np.arange(n)
    width = 0.82 / m
    fig, ax = plt.subplots(figsize=(13.4, 7), dpi=100)
    for i, slot in enumerate(SLOTS):
        vals = [meta[slot][k] for k in keys]
        pos = x + (i - (m - 1) / 2) * width
        ax.bar(pos, vals, width * 0.92, color=COLORS[i], label=LABELS[i])
        for px, v in zip(pos, vals):
            ax.annotate('{:.1f}'.format(v), (px, v), textcoords='offset points',
                        xytext=(0, 4), ha='center', va='bottom', fontsize=11,
                        color='#e6edf3', fontweight='bold')
    ax.set_xticks(list(x))
    ax.set_xticklabels(groups, fontsize=12.5)
    style_ax(ax, 'GiB', 1.16)
    ax.legend(loc='upper left', bbox_to_anchor=(0.0, 1.0), ncol=3, fontsize=12,
              frameon=True, facecolor='#161b22', edgecolor='#30363d', labelcolor=LABEL)
    fig.tight_layout()
    fig.savefig(os.path.join(OUT, 'speed_memory.png'), facecolor=BG, bbox_inches='tight')
    plt.close(fig)


def load_chart():
    _, meta = load()
    fig, ax = plt.subplots(figsize=(9.5, 6), dpi=100)
    vals = [meta[m]['load'] for m in SLOTS]
    pos = np.arange(len(SLOTS))
    ax.bar(pos, vals, 0.6, color=COLORS)
    for p, v in zip(pos, vals):
        ax.annotate('{:.1f} s'.format(v), (p, v), textcoords='offset points',
                    xytext=(0, 5), ha='center', fontsize=12.5, color='#e6edf3',
                    fontweight='bold')
    ax.set_xticks(list(pos))
    ax.set_xticklabels(['Ninfer6000', 'vLLM', 'llama.cpp'], fontsize=13)
    style_ax(ax, 'seconds to load + warm up', 1.18)
    fig.tight_layout()
    fig.savefig(os.path.join(OUT, 'speed_load.png'), facecolor=BG, bbox_inches='tight')
    plt.close(fig)


line_chart('speed_ttft.png', 'ttft', 'time to first token (s)', '{:.2f}', logy=True,
           offsets={0: (0, 13), 1: (0, -19), 2: (0, 12)})
line_chart('speed_prefill.png', 'prefill', 'prefill tok/s', '{:,.0f}', y_pad=1.22)
line_chart('speed_decode_stream.png', 'decode', 'decode tok/s', '{:.0f}', y_pad=1.22)
memory_chart()
load_chart()
print('speed charts written to', OUT)

