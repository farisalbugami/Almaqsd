# -*- coding: utf-8 -*-
"""موسيقى خلفية هادئة للفيديو — 58 ثانية، سلم Dm، إيقاع بطيء واثق"""
import numpy as np, wave, struct

SR = 48000
DUR = 58.6
N = int(SR * DUR)
t = np.arange(N) / SR

def note(freq, start, length, amp, detune=0.004, attack=0.9, release=2.4, harmonics=(1, .38, .16, .07)):
    """نغمة بادّ دافئة مع توافقيات وظرف صعود/هبوط ناعم"""
    i0, i1 = int(start * SR), int(min(DUR, start + length) * SR)
    n = i1 - i0
    if n <= 0: return
    lt = np.arange(n) / SR
    sig = np.zeros(n)
    for k, h in enumerate(harmonics, start=1):
        for d in (-detune, 0.0, detune):
            sig += h * np.sin(2 * np.pi * freq * k * (1 + d) * lt)
    sig /= len(harmonics) * 3
    env = np.ones(n)
    a = int(min(attack, length) * SR)
    r = int(min(release, length) * SR)
    if a: env[:a] = np.linspace(0, 1, a) ** 1.6
    if r: env[-r:] *= np.linspace(1, 0, r) ** 1.8
    # تموّج خفيف يعطي إحساس الحياة
    env *= 1 + 0.05 * np.sin(2 * np.pi * 0.19 * lt)
    out[i0:i1] += amp * sig * env

out = np.zeros(N)

# سلم Dm — تقدم: Dm · Bb · F · C · Dm · Bb · Gm · A
NOTES = {"D3":146.83,"F3":174.61,"A3":220.00,"Bb3":233.08,"C4":261.63,"D4":293.66,
         "F4":349.23,"A4":440.00,"Bb2":116.54,"F2":87.31,"C3":130.81,"D2":73.42,
         "G3":196.00,"Bb4":466.16,"G2":98.00,"A2":110.00,"E4":329.63}

BAR = 7.32  # ثمانية أوتار تملأ 58.6 ثانية
CHORDS = [
    ("D2", ["D3","F3","A3","D4"]),      # Dm
    ("Bb2",["Bb3","D4","F4"]),          # Bb
    ("F2", ["F3","A3","C4","F4"]),      # F
    ("C3", ["C4","E4","G3"]),           # C
    ("D2", ["D3","F3","A3","D4"]),      # Dm
    ("Bb2",["Bb3","D4","F4"]),          # Bb
    ("G2", ["G3","Bb3","D4"]),          # Gm
    ("A2", ["A3","C4","E4","A4"]),      # A  (نهاية مفتوحة)
]

for i, (bass, chord) in enumerate(CHORDS):
    st = i * BAR
    note(NOTES[bass], st, BAR + 1.6, 0.30, attack=1.1, release=2.6, harmonics=(1, .25, .08))
    for j, nm in enumerate(chord):
        note(NOTES[nm], st + 0.05 * j, BAR + 1.4, 0.155, attack=1.3, release=2.8)

# طبقة لمعان عالية خفيفة جداً
for i, (_, chord) in enumerate(CHORDS):
    note(NOTES[chord[-1]] * 2, i * BAR + 0.4, BAR, 0.026, attack=2.0, release=2.6, harmonics=(1, .2))

# نبضة خافتة كل نصف وتر — تعطي إحساس تقدّم بدون إيقاع صاخب
for k in range(int(DUR / (BAR / 2))):
    st = k * (BAR / 2)
    i0 = int(st * SR); n = int(0.5 * SR)
    if i0 + n > N: break
    lt = np.arange(n) / SR
    thump = np.sin(2 * np.pi * 55 * lt) * np.exp(-lt * 9)
    out[i0:i0 + n] += 0.085 * thump

# صدى/رحابة بسيطة
def reverb(x, taps=((0.045, .34), (0.083, .24), (0.131, .17), (0.197, .11), (0.281, .06))):
    y = x.copy()
    for d, g in taps:
        k = int(d * SR)
        y[k:] += g * x[:-k]
    return y
out = reverb(out)

# ترشيح لتليين الحواف العالية (متوسط متحرك بسيط)
w = 9
kernel = np.hanning(w); kernel /= kernel.sum()
out = np.convolve(out, kernel, mode="same")

# ظرف عام: دخول وخروج
fade_in = int(2.2 * SR); fade_out = int(3.4 * SR)
out[:fade_in] *= np.linspace(0, 1, fade_in) ** 1.5
out[-fade_out:] *= np.linspace(1, 0, fade_out) ** 1.4

# تطبيع آمن إلى ‎-16 dBFS‎ ذروة (يترك مساحة للتعليق الصوتي)
peak = np.max(np.abs(out))
target = 10 ** (-16 / 20)
out = out / peak * target
rms = np.sqrt(np.mean(out ** 2))

# ستيريو بعرض بسيط
left = out
right = np.concatenate([np.zeros(int(0.011 * SR)), out[:-int(0.011 * SR)]])
stereo = np.stack([left, right], axis=1)

pcm = (stereo * 32767).astype("<i2")
with wave.open("/tmp/claude-0/-home-user-Almaqsd/474d8ce8-62a1-50f0-a8f2-7e31cf8ad046/scratchpad/video/music.wav", "wb") as w_:
    w_.setnchannels(2); w_.setsampwidth(2); w_.setframerate(SR)
    w_.writeframes(pcm.tobytes())

print(f"المدة: {DUR}s · الذروة: {20*np.log10(np.max(np.abs(out))):.1f} dBFS · RMS: {20*np.log10(rms):.1f} dBFS")
print(f"قص (clipping): {int(np.sum(np.abs(stereo) >= 0.999))} عينة")
