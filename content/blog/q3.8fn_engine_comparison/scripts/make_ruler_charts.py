#!/usr/bin/env python3
"""RULER ladder charts from results/qwen38-flash-next-ruler-full/ruler_detail/*.json.

Seven haystack tiers, 4,096 -> 224,000 tokens (256,827 prepared), one pass per engine.
Titles live in the Markdown figure captions, so they are not baked into the PNGs.
"""
import json
import os
import statistics as st
import sys
from collections import defaultdict

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(HERE)
RUN = os.path.join(os.path.dirname(HERE), 'results', 'qwen38-flash-next-ruler-full',
                   'ruler_detail')

SLOTS = ['Ninfer6000', 'vLLM NVFP4', 'llama.cpp Q4_K_XL']
LABELS = ['Ninfer6000 (nvfp4)', 'vLLM (nvfp4)', 'llama.cpp (Q4_K_XL)']
COLORS = ['#d2a8ff', '#58a6ff', '#f0883e']
FILE = {'Ninfer6000': 'qwen3.8-flash-next-ninfer6000',
        'vLLM NVFP4': 'qwen3.8-flash-next-nvfp4',
        'llama.cpp Q4_K_XL': 'Qwen3.8-Flash-Next-UD-Q4_K_XL'}
TIERS = [4096, 16384, 32768, 65536, 131072, 180000, 224000]
# x labels are the prepared prompt tokens the server reported, not the tier name
BANDS = ['4.8k', '18.9k', '37.8k', '75.3k', '150.4k', '206.4k', '256.8k']

BG, TITLE, LABEL, GRID, SPINE, TEXT = ('#0d1117', '#58a6ff', '#c9d1d9', '#21262d',
                                       '#30363d', '#c9d1d9')
plt.rcParams.update({
    'figure.facecolor': BG, 'axes.facecolor': BG, 'savefig.facecolor': BG,
    'axes.edgecolor': SPINE, 'axes.labelcolor': LABEL, 'xtick.color': LABEL,
    'ytick.color': LABEL, 'text.color': TEXT, 'font.size': 13,
    'axes.grid': True, 'grid.color': GRID, 'grid.linewidth': 0.8})


def style_ax(ax, ylabel=None, y_pad=1.14, floor=None, top=None):
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
    lo, hi = ax.get_ylim()
    ax.set_ylim(floor if floor is not None else lo, top if top is not None else hi * y_pad)


def legend(ax, ncol=3, loc='lower left'):
    # Anchored above the axes so the legend never covers bars or points, which is
    # what happens on the bar charts where the tallest bars reach the top of the frame.
    ax.legend(loc=loc, bbox_to_anchor=(0.0, 1.02), ncol=ncol, fontsize=12, frameon=True,
              facecolor='#161b22', edgecolor='#30363d', labelcolor=LABEL)


def load():
    """-> {slot: {tier: {'score': %, 'lat': s, 'p95': s, 'prep': tokens, 'n': int}}}"""
    out = {}
    for slot, fn in FILE.items():
        samples = json.load(open(os.path.join(RUN, fn + '.json')))['samples']
        by = defaultdict(lambda: defaultdict(list))
        for s in samples:
            t = int(float(s['target_tokens']))
            by[t]['score'].append(float(s['score']))
            by[t]['lat'].append(float(s['latency_s']))
            by[t]['prep'].append(int(s['server_prompt_tokens']))
        out[slot] = {}
        for t in TIERS:
            d = by[t]
            lat = sorted(d['lat'])
            out[slot][t] = dict(score=100.0 * st.mean(d['score']), lat=st.mean(lat),
                                p95=lat[max(0, int(round(0.95 * (len(lat) - 1))))],
                                prep=st.mean(d['prep']), n=len(d['lat']))
    return out



def ladder_chart(data):
    fig, ax = plt.subplots(figsize=(13.2, 7), dpi=100)
    x = np.arange(len(TIERS))
    for i, slot in enumerate(SLOTS):
        ys = [data[slot][t]['score'] for t in TIERS]
        ax.plot(x, ys, color=COLORS[i], lw=2.6, marker='o', ms=8, label=LABELS[i],
                zorder=3 + i)
        # Ninfer below, vLLM above, llama.cpp further above: the series sit on top of
        # each other at several tiers, so stacked offsets are the only legible option.
        dy = {0: -21, 1: 12, 2: 26}[i]
        for xi, yi in zip(x, ys):
            ax.annotate('{:.2f}'.format(yi), (xi, yi), textcoords='offset points',
                        xytext=(0, dy), ha='center', fontsize=11, color='#e6edf3',
                        fontweight='bold')
    ax.set_xticks(list(x))
    ax.set_xticklabels(BANDS, fontsize=13.5)
    ax.set_xlabel('prepared prompt tokens (haystack + chat template)', fontsize=13)
    style_ax(ax, 'RULER score (%)', floor=96.3, top=101.6)
    ax.set_yticks([96.5, 97.5, 98.5, 99.5, 100.0])
    ax.set_yticklabels(['96.5', '97.5', '98.5', '99.5', '100'])
    legend(ax)
    fig.tight_layout()
    fig.savefig(os.path.join(OUT, 'ruler.png'), facecolor=BG, bbox_inches='tight')
    plt.close(fig)


def latency_chart(data):
    fig, ax = plt.subplots(figsize=(12.6, 7), dpi=100)
    x = np.arange(len(TIERS))
    for i, slot in enumerate(SLOTS):
        ys = [data[slot][t]['lat'] for t in TIERS]
        ax.plot(x, ys, color=COLORS[i], lw=2.6, marker='o', ms=8, label=LABELS[i],
                zorder=3 + i)
        dy = {0: 12, 1: -20, 2: 12}[i]
        for xi, yi in zip(x, ys):
            ax.annotate(('{:.1f}' if yi < 10 else '{:.0f}').format(yi), (xi, yi),
                        textcoords='offset points', xytext=(0, dy), ha='center',
                        fontsize=11, color='#e6edf3', fontweight='bold')
    ax.set_xticks(list(x))
    ax.set_xticklabels(BANDS, fontsize=13.5)
    ax.set_xlabel('prepared prompt tokens (haystack + chat template)', fontsize=13)
    ax.set_yscale('log')
    lo = min(data[s][t]['lat'] for s in SLOTS for t in TIERS)
    hi = max(data[s][t]['lat'] for s in SLOTS for t in TIERS)
    ax.set_ylim(lo / 2.4, hi * 2.6)
    ax.set_yticks([0.5, 1, 5, 10, 50, 100])
    ax.set_yticklabels(['0.5', '1', '5', '10', '50', '100'])
    ax.minorticks_off()
    ax.set_ylabel('seconds per request (log scale)')
    legend(ax, loc='upper left')
    fig.tight_layout()
    fig.savefig(os.path.join(OUT, 'ruler_latency.png'), facecolor=BG, bbox_inches='tight')
    plt.close(fig)


def vt_chart():
    """variable_tracking is the only task any engine ever missed."""
    fig, ax = plt.subplots(figsize=(13.2, 7), dpi=100)
    raw = {}
    for slot, fn in FILE.items():
        samples = json.load(open(os.path.join(RUN, fn + '.json')))['samples']
        by = defaultdict(list)
        for s in samples:
            if s['task'] == 'vt':
                by[int(float(s['target_tokens']))].append(float(s['score']))
        raw[slot] = by
    x = np.arange(len(TIERS))
    width = 0.82 / len(SLOTS)
    for i, slot in enumerate(SLOTS):
        pos = x + (i - (len(SLOTS) - 1) / 2) * width
        ys = [100.0 * st.mean(raw[slot][t]) for t in TIERS]
        ax.bar(pos, ys, width * 0.92, color=COLORS[i], label=LABELS[i])
        dy = {0: 4, 1: 16, 2: 28}[i]
        for px, yi in zip(pos, ys):
            # Staggered per series: neighbouring bars share a height at most tiers, so
            # one label height would overprint. The miss counts live in the article table.
            ax.annotate('{:.1f}'.format(yi), (px, yi), textcoords='offset points',
                        xytext=(0, dy), ha='center', fontsize=10.5, color='#e6edf3',
                        fontweight='bold', bbox=dict(boxstyle='round,pad=0.15',
                        facecolor='#0d1117', edgecolor='none', alpha=0.85))
    ax.set_xticks(list(x))
    ax.set_xticklabels(BANDS, fontsize=13.5)
    ax.set_xlabel('prepared prompt tokens (haystack + chat template)', fontsize=13)
    style_ax(ax, 'variable_tracking score (%)', floor=84, top=102.8)
    ax.set_yticks([85, 90, 95, 100])
    legend(ax, loc='lower left')
    fig.tight_layout()
    fig.savefig(os.path.join(OUT, 'ruler_vt.png'), facecolor=BG, bbox_inches='tight')
    plt.close(fig)


DATA = load()
ladder_chart(DATA)
latency_chart(DATA)
vt_chart()
print('ruler charts written to', OUT)
for t in TIERS:
    print('%8d  ' % t + '  '.join('%s %6.2f  %6.2fs  prep=%7.0f'
                                  % (s[:4], DATA[s][t]['score'], DATA[s][t]['lat'],
                                     DATA[s][t]['prep']) for s in SLOTS))
