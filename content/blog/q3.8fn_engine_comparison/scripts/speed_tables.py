import csv, statistics as st, os

HERE = os.path.dirname(os.path.abspath(__file__))
p = os.path.join(os.path.dirname(HERE), 'results', 'speed_bench.csv')
NAME = {'qwen3.8-flash-next-ninfer6000': 'ninfer',
        'qwen3.8-flash-next-nvfp4': 'vllm',
        'Qwen3.8-Flash-Next-UD-Q4_K_XL': 'llama'}
CTX = [1024, 8192, 32768, 65536, 131072]
rows = list(csv.DictReader(open(p)))
acc, meta = {}, {}
for r in rows:
    m, c = NAME[r['model']], int(r['ctx'])
    d = acc.setdefault(m, {}).setdefault(c, {})
    for k in ('ttft_s', 'prefill_tps', 'decode_tps', 'prompt_tokens', 'gen_tokens'):
        d.setdefault(k, []).append(float(r[k]))
    meta[m] = {k: float(r[k]) for k in ('load_s', 'vram_loaded_gib', 'vram_peak_gib',
                                        'ram_loaded_gib', 'ram_peak_gib',
                                        'cache_peak_gib', 'gpu_proc_rss_peak_gib')}
data = {m: {c: {k: st.mean(v) for k, v in d.items()} for c, d in byc.items()}
        for m, byc in acc.items()}
out = []
for c in CTX:
    n, v, l = (data[m][c] for m in ('ninfer', 'vllm', 'llama'))
    out.append('ctx %d prompt=%.0f gen=%.0f' % (c, n['prompt_tokens'], n['gen_tokens']))
    for m in ('ninfer', 'vllm', 'llama'):
        d = data[m][c]
        out.append('   %-5s ttft=%.2f prefill=%.0f decode=%.1f' %
                   (m, d['ttft_s'], d['prefill_tps'], d['decode_tps']))
    out.append('   ratios decode n/v=%.2f n/l=%.2f v/l=%.2f | prefill v/n=%.2f n/l=%.2f | ttft v/n=%.2f l/n=%.2f'
               % (n['decode_tps'] / v['decode_tps'], n['decode_tps'] / l['decode_tps'],
                  v['decode_tps'] / l['decode_tps'], v['prefill_tps'] / n['prefill_tps'],
                  n['prefill_tps'] / l['prefill_tps'], v['ttft_s'] / n['ttft_s'],
                  l['ttft_s'] / n['ttft_s']))
    for gen in (512, 2048, 8192):
        e = {m: data[m][c]['ttft_s'] + gen / data[m][c]['decode_tps']
             for m in ('ninfer', 'vllm', 'llama')}
        out.append('   e2e gen=%d: n=%.1fs v=%.1fs l=%.1fs' % (gen, e['ninfer'], e['vllm'], e['llama']))
for m in ('ninfer', 'vllm', 'llama'):
    out.append('%s meta %s' % (m, meta[m]))
    dd = [data[m][c]['decode_tps'] for c in CTX]
    pp = [data[m][c]['prefill_tps'] for c in CTX]
    out.append('   decode min=%.0f max=%.0f spread=%.0f%% | prefill min=%.0f max=%.0f' %
               (min(dd), max(dd), (1 - min(dd) / max(dd)) * 100, min(pp), max(pp)))
out.append('--- crossover output tokens where Ninfer6000 end-to-end beats vLLM ---')
for c in CTX:
    n, v = data['ninfer'][c], data['vllm'][c]
    dt = n['ttft_s'] - v['ttft_s']
    inv = 1.0 / v['decode_tps'] - 1.0 / n['decode_tps']
    out.append('ctx %6d: crossover gen=%6.0f tokens (ttft gap %.2fs, decode gain %.4fs/token)'
               % (c, dt / inv, dt, inv))
out.append('--- aggregate means over all 5 context lengths ---')
for m in ('ninfer', 'vllm', 'llama'):
    dd = [data[m][c]['decode_tps'] for c in CTX]
    pp = [data[m][c]['prefill_tps'] for c in CTX]
    tt = [data[m][c]['ttft_s'] for c in CTX]
    out.append('%-5s mean decode=%.0f mean prefill=%.0f mean ttft=%.2f' %
               (m, st.mean(dd), st.mean(pp), st.mean(tt)))
open('/tmp/speed_tables.txt', 'w').write('\n'.join(out) + '\n')
print('\n'.join(out))
