#!/usr/bin/env python3
"""Generate dark-mode benchmark charts for the q3.8fn engine comparison post."""
import csv
import json
import os
import sys

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(HERE)
os.makedirs(OUT, exist_ok=True)
ROOT = os.path.join(os.path.dirname(HERE), 'results')
RUN2 = os.path.join(ROOT, 'qwen38-flash-next-engines-r3-rerun')
AGG_PATH = sys.argv[2] if len(sys.argv) > 2 else os.path.join(RUN2, 'aggregate.json')
AGG = json.load(open(AGG_PATH))

SLOTS = ['Ninfer6000', 'vLLM NVFP4', 'llama.cpp Q4_K_XL']
LABELS = ['Ninfer6000 (nvfp4)', 'vLLM (nvfp4)', 'llama.cpp (Q4_K_XL)']
COLORS = ['#d2a8ff', '#58a6ff', '#f0883e']
RAW = {'Ninfer6000': 'qwen3.8-flash-next-ninfer6000',
       'vLLM NVFP4': 'qwen3.8-flash-next-nvfp4',
       'llama.cpp Q4_K_XL': 'Qwen3.8-Flash-Next-UD-Q4_K_XL'}

BG, TITLE, LABEL, GRID, SPINE, TEXT = ('#0d1117', '#58a6ff', '#c9d1d9', '#21262d',
                                       '#30363d', '#c9d1d9')
# Titles live in the Markdown figure captions (matches the site's chart style),
# so they are not baked into the PNGs.
SHOW_TITLES = False
plt.rcParams.update({
    'figure.facecolor': BG, 'axes.facecolor': BG, 'savefig.facecolor': BG,
    'axes.edgecolor': SPINE, 'axes.labelcolor': LABEL, 'xtick.color': LABEL,
    'ytick.color': LABEL, 'text.color': TEXT, 'font.size': 13, 'axes.titlesize': 18,
    'axes.grid': True, 'grid.color': GRID, 'grid.linewidth': 0.8})


def style_ax(ax, ylabel=None, y_pad=1.14):
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
    ax.set_ylim(ymin, ymax * y_pad if ymax > 0 else ymax)


def bar_chart(path, title, groups, series_values, series_sd=None, ylabel='Score (%)',
              ylim_floor=0.0, fmt='{:.1f}%', rotation=0, colors=COLORS, labels=LABELS,
              legend=True, wide=False, annotate=True, legend_loc='lower left',
              ann_fontsize=11, xtick_pos=None, ylim_top=None, y_pad=1.14):
    n, m = len(groups), len(series_values)
    x = np.arange(n)
    width = (0.82 if m <= 3 else 0.86) / m
    fig, ax = plt.subplots(figsize=(15, 6.6) if wide else (12, 7), dpi=100)
    for i in range(m):
        vals = np.array(series_values[i], dtype=float)
        pos = x + (i - (m - 1) / 2) * width
        err = None
        if series_sd:
            err = np.nan_to_num(np.array(series_sd[i], dtype=float), nan=0.0)
        ax.bar(pos, vals, width * 0.92, color=colors[i], label=labels[i], yerr=err,
               capsize=4, error_kw=dict(ecolor='#8b949e', lw=1.2, capthick=1.2))
        if annotate:
            for px, v in zip(pos, vals):
                if not np.isnan(v):
                    ax.annotate(fmt.format(v), (px, v), textcoords='offset points',
                                xytext=(0, 4), ha='center', va='bottom',
                                fontsize=ann_fontsize,
                                color='#e6edf3', fontweight='bold')
    ax.set_xticks(list(xtick_pos) if xtick_pos is not None else x)
    ax.set_xticklabels(groups, rotation=rotation,
                       ha='right' if rotation else 'center', fontsize=13)
    ax.set_ylim(ylim_floor, None)
    style_ax(ax, ylabel, y_pad)
    if ylim_top is not None:
        ax.set_ylim(ylim_floor, ylim_top)
    if SHOW_TITLES and title:
        ax.set_title(title, color=TITLE, pad=16)
    if legend:
        ax.legend(loc=legend_loc, bbox_to_anchor=(0.0, 1.0), ncol=m, fontsize=12,
                  frameon=True, facecolor='#161b22', edgecolor='#30363d', labelcolor=LABEL)
    fig.tight_layout()
    fig.savefig(os.path.join(OUT, path), facecolor=BG, bbox_inches='tight')
    plt.close(fig)


def mean_sd(model, bench):
    row = AGG['summary'][bench][model]
    return row['mean'], row['sd']


def single_chart(path, title, bench, ylabel='Score (%)', floor=0.0, fmt='{:.1f}%',
                 wide=True):
    # One series per engine so each engine keeps its own colour, one group per bar.
    vals = [[mean_sd(m, bench)[0]] for m in SLOTS]
    sd = [[mean_sd(m, bench)[1]] for m in SLOTS]
    width = 0.82 / len(SLOTS)
    pos = [(i - (len(SLOTS) - 1) / 2) * width for i in range(len(SLOTS))]
    bar_chart(path, title, LABELS, vals, sd, ylabel=ylabel, ylim_floor=floor, fmt=fmt,
              rotation=18, legend=False, wide=wide, xtick_pos=pos)


def overall_chart():
    benches = ['bfcl_v4', 'ifeval', 'mmlu_pro', 'humaneval_plus', 'mbpp_plus']
    names = ['BFCL v4', 'IFEval\n(prompt-strict)', 'MMLU-Pro', 'HumanEval+', 'MBPP+']
    vals = [[mean_sd(m, b)[0] for b in benches] for m in SLOTS]
    sd = [[mean_sd(m, b)[1] for b in benches] for m in SLOTS]
    bar_chart('accuracy_overview.png',
              'Qwen3.8-Flash-Next - Accuracy by Engine (3-run mean, SD whiskers)',
              names, vals, sd, ylabel='Score (%)', ylim_floor=50)


def bfcl_charts():
    single_chart('bfcl_v4_overall.png',
                 'BFCL v4 - Overall Accuracy (1,000 prompts x 3 runs, SD whiskers)',
                 'bfcl_v4', floor=50)
    subsets = [('simple_python', 'Non-Live\nSimple'), ('multiple', 'Non-Live\nMultiple'),
               ('parallel', 'Non-Live\nParallel'), ('irrelevance', 'Irrelevance'),
               ('live_multiple', 'Live\nMultiple'), ('multi_turn_base', 'Multi-Turn\nBase')]
    groups = [g for _, g in subsets]
    vals = [[AGG['bfcl_sub'][m][k][0] for k, _ in subsets] for m in SLOTS]
    sd = [[AGG['bfcl_sub'][m][k][1] for k, _ in subsets] for m in SLOTS]
    bar_chart('bfcl_v4_subsets.png', 'BFCL v4 - Accuracy by Subset (3-run mean)',
              groups, vals, sd, ylabel='Score (%)', ylim_floor=0, wide=True,
              ann_fontsize=10)


def ifeval_chart():
    metrics = [('mean_prompt_level_strict', 'Prompt-Level\nStrict'),
               ('mean_inst_level_strict', 'Inst-Level\nStrict'),
               ('mean_prompt_level_loose', 'Prompt-Level\nLoose'),
               ('mean_inst_level_loose', 'Inst-Level\nLoose')]
    groups = [g for _, g in metrics]
    vals = [[np.mean(AGG['ifeval'][m][k]) for k, _ in metrics] for m in SLOTS]
    sd = [[np.std(AGG['ifeval'][m][k]) for k, _ in metrics] for m in SLOTS]
    bar_chart('ifeval.png', 'IFEval - Instruction Following (541 prompts, 3 runs)',
              groups, vals, sd, ylabel='Score (%)', ylim_floor=75)


def mmlu_charts():
    order = ['computer science', 'math', 'chemistry', 'engineering', 'law', 'biology',
             'health', 'physics', 'business', 'philosophy', 'economics', 'other',
             'psychology', 'history']
    groups = ['Computer\nScience', 'Math', 'Chemistry', 'Engineering', 'Law', 'Biology',
              'Health', 'Physics', 'Business', 'Philosophy', 'Economics', 'Other',
              'Psychology', 'History']
    vals = [[AGG['mmlu'][m].get(c, np.nan) for c in order] for m in SLOTS]
    bar_chart('mmlu_pro_categories.png', 'MMLU-Pro - Accuracy by Category (3-run mean)',
              groups, vals, ylabel='Accuracy (%)', ylim_floor=0, rotation=45,
              annotate=False, wide=True)
    single_chart('mmlu_pro_overall.png',
                 'MMLU-Pro - Overall Accuracy (12,032 questions x 3 runs)',
                 'mmlu_pro', floor=50)


def coding_chart():
    groups = ['HumanEval+\n(164 problems)', 'MBPP+\n(378 problems)']
    vals = [[mean_sd(m, 'humaneval_plus')[0], mean_sd(m, 'mbpp_plus')[0]] for m in SLOTS]
    sd = [[mean_sd(m, 'humaneval_plus')[1], mean_sd(m, 'mbpp_plus')[1]] for m in SLOTS]
    bar_chart('coding.png', 'Coding - HumanEval+ & MBPP+ pass@1 (3 runs)',
              groups, vals, sd, ylabel='pass@1 (%)', ylim_floor=88, ylim_top=98.5, y_pad=1.02)


def speed_charts():
    benches = [('bfcl_v4', 'BFCL v4'), ('ifeval', 'IFEval'), ('mmlu_pro', 'MMLU-Pro'),
               ('humaneval_plus', 'HumanEval+'), ('mbpp_plus', 'MBPP+')]
    groups = [g for _, g in benches]
    vals = [[AGG['speed'][b][m]['tps'] for b, _ in benches] for m in SLOTS]
    bar_chart('speed_decode.png',
              'Decoding Speed by Benchmark (output tokens/s, mean per request)',
              groups, vals, ylabel='tok/s', ylim_floor=0, fmt='{:.0f}')
    vals = [[AGG['speed'][b][m]['lat_mean'] for b, _ in benches] for m in SLOTS]
    bar_chart('speed_latency.png',
              'End-to-End Latency by Benchmark (mean wall time per request)',
              groups, vals, ylabel='seconds', ylim_floor=0, fmt='{:.2f}')


def ruler_chart(title=None):
    """Superseded. RULER is now the 7-tier deep ladder and lives in its own script.

    scripts/make_ruler_charts.py writes ruler.png / ruler_latency.png / ruler_vt.png
    from results/qwen38-flash-next-ruler-full. This stub stays so the old call site
    keeps working and cannot overwrite the deep-ladder ruler.png.
    """
    print('ruler charts: see scripts/make_ruler_charts.py (deep ladder run)')


def arena_chart():
    groups = ['Judge winrate vs baseline\n(evalscope judge)',
              'Paired win rate\n(single pass)']
    vals = [[AGG['arena'][m]['winrate'], AGG['arena'][m]['score_mean']] for m in SLOTS]
    bar_chart('arena_hard.png',
              'Arena-Hard - Win Rate (500 prompts, 75 judged, single pass, temp 0.6 / 16,384 cap)',
              groups, vals, ylabel='Score (%)', ylim_floor=0, legend=True, y_pad=1.3)


def run1_chart():
    benches = [('bfcl_v4', 'BFCL v4'), ('ifeval', 'IFEval\n(prompt-strict)'),
               ('mmlu_pro', 'MMLU-Pro'), ('humaneval_plus', 'HumanEval+'),
               ('mbpp_plus', 'MBPP+')]
    groups = [g for _, g in benches]
    vals = [[AGG['run1'][b][m] for b, _ in benches] for m in SLOTS]
    bar_chart('run1_baseline.png', 'Run 1 - greedy decoding, 2k output cap (single run)',
              groups, vals, ylabel='Score (%)', ylim_floor=50)


overall_chart()
bfcl_charts()
arena_chart()
ifeval_chart()
mmlu_charts()
coding_chart()
speed_charts()
ruler_chart()
run1_chart()
print('charts written to', OUT)
for name in sorted(os.listdir(OUT)):
    print(' -', name, os.path.getsize(os.path.join(OUT, name)))


