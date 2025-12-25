import streamlit as st
import math
import matplotlib.pyplot as plt
import numpy as np

st.set_page_config(page_title="Dekodek", layout="wide")

class DecoPlanner:
    def __init__(self, depth, bottom_time, v_up, sac, tank_v, p_dep, gf_low, gf_high, fO2_bottom, fO2_deco=None):
        self.depth = depth
        self.bottom_time = bottom_time
        self.v_up = v_up
        self.sac = sac
        self.tank_v = tank_v
        self.p_dep = p_dep
        self.gf_low = gf_low / 100.0
        self.gf_high = gf_high / 100.0
        self.fO2_bottom = fO2_bottom / 100.0
        self.fN2_bottom = 1.0 - self.fO2_bottom
        self.fO2_deco = fO2_deco / 100.0 if fO2_deco else self.fO2_bottom
        self.fN2_deco = 1.0 - self.fO2_deco
        self.dt = 0.1 
        
        # ZH-L16C Coefficients
        self.hl = [4.0, 5.0, 8.0, 12.5, 18.5, 27.0, 38.3, 54.3, 77.0, 109.0, 146.0, 187.0, 239.0, 305.0, 390.0, 498.0]
        self.a = [1.2599, 1.0000, 0.8618, 0.7562, 0.6667, 0.5600, 0.4947, 0.4500, 0.4187, 0.3798, 0.3497, 0.3223, 0.2850, 0.2737, 0.2523, 0.2327]
        self.b = [0.5050, 0.6314, 0.7222, 0.7825, 0.8126, 0.8434, 0.8693, 0.8910, 0.9092, 0.9222, 0.9319, 0.9403, 0.9477, 0.9544, 0.9602, 0.9653]
        
        self.tissues = [0.79] * 16 
        self.log = {"time": [], "depth": [], "tissues": [[] for _ in range(16)], "cons": 0, "ppo2": []}

    def update(self, d, t, is_deco=False):
        p_amb = (d / 10.0) + 1.0
        fN2 = self.fN2_deco if is_deco and d <= self.get_switch_depth() else self.fN2_bottom
        fO2 = 1.0 - fN2
        
        self.log["cons"] += self.sac * p_amb * self.dt
        self.log["ppo2"].append(p_amb * fO2)
        
        p_alv = (p_amb - 0.0627) * fN2
        for i in range(16):
            k = math.log(2) / self.hl[i]
            self.tissues[i] = p_alv + (self.tissues[i] - p_alv) * math.exp(-k * self.dt)
            self.log["tissues"][i].append(self.tissues[i])
        self.log["time"].append(t)
        self.log["depth"].append(d)

    def get_switch_depth(self):
        # Profondeur max pour le gaz de déco (PPO2 1.6 max)
        return (1.6 / self.fO2_deco - 1.0) * 10.0

    def get_ceiling(self, current_depth):
        gf_slope = (self.gf_high - self.gf_low) / (0 - self.depth)
        current_gf = self.gf_high + gf_slope * current_depth
        ceilings = []
        for i in range(16):
            num = self.tissues[i] - self.a[i] * current_gf
            den = current_gf / self.b[i] + 1.0 - current_gf
            ceilings.append(num / den)
        return max(0, (max(ceilings) - 1.0) * 10.0)

    def run(self):
        t, curr_d = 0, 0.0
        # 1. Descente
        while curr_d < self.depth:
            self.update(curr_d, t)
            curr_d += 15.0 * self.dt
            t += self.dt
        # 2. Fond
        t_end_bottom = t + self.bottom_time
        while t < t_end_bottom:
            self.update(self.depth, t)
            t += self.dt
        # 3. Remontée
        curr_d = self.depth
        while curr_d > 0:
            ceiling = self.get_ceiling(curr_d)
            next_stop = math.ceil(ceiling / 3.0) * 3.0
            if curr_d > next_stop:
                curr_d -= (self.v_up * self.dt)
                if curr_d < next_stop: curr_d = next_stop
            else:
                curr_d = next_stop
            self.update(curr_d, t, is_deco=True)
            t += self.dt
            if curr_d == 0 and self.get_ceiling(0) <= 0: break
        return self.log

# --- Streamlit UI ---
st.sidebar.header("Mélanges Gazeux")
fO2_bottom = st.sidebar.slider("Oxygène Fond (%)", 21, 40, 32)
fO2_deco = st.sidebar.selectbox("Gaz de Déco (Optionnel)", [None, 50, 80, 100])

mod = (1.6 / (fO2_bottom/100) - 1.0) * 10.0
st.sidebar.warning(f"MOD (PPO2 1.6) : {round(mod, 1)}m")

with st.sidebar:
    prof_max = st.number_input("Profondeur Max (m)", 10, int(mod), min(40, int(mod)))
    t_fond = st.number_input("Temps au Fond (min)", 1, 60, 20)
    gf_low = st.slider("GF Low", 10, 100, 30)
    gf_high = st.slider("GF High", 10, 100, 70)
    sac = st.number_input("SAC (L/min)", 10.0, 30.0, 19.0)
    vol_bloc = st.number_input("Volume Bloc (L)", 1, 40, 15)

planner = DecoPlanner(prof_max, t_fond, 10, sac, vol_bloc, 200, gf_low, gf_high, fO2_bottom, fO2_deco)
res = planner.run()

# --- Affichage ---
st.title(f"Dekodek Multi-Gaz : EAN{fO2_bottom}" + (f" + EAN{fO2_deco}" if fO2_deco else ""))

c1, c2, c3 = st.columns(3)
c1.metric("Durée Totale", f"{round(res['time'][-1], 1)} min")
c2.metric("Pression Finale", f"{int(200 - (res['cons']/vol_bloc))} bar")
c3.metric("PPO2 Max", f"{round(max(res['ppo2']), 2)} bar")

fig, ax = plt.subplots(figsize=(12, 5))
ax.plot(res["time"], res["depth"], color='cyan', lw=3, label="Profil")
ax.set_ylabel("Profondeur (m)")
ax.invert_yaxis()
ax.grid(alpha=0.2)

# Colorer la zone où la déco est active
if fO2_deco:
    switch_idx = next(i for i, d in enumerate(res["depth"]) if d <= planner.get_switch_depth() and i > len(res["depth"])/2)
    ax.plot(res["time"][switch_idx:], res["depth"][switch_idx:], color='lime', lw=4, label=f"Switch EAN{fO2_deco}")

st.pyplot(fig)