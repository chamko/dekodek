export interface DiveLog {
  time: number[];
  depth: number[];
  tissues: number[][];
  cons: number;
  ppo2: number[];
}

export class DecoPlanner {
  private depth: number;
  private bottomTime: number;
  private vUp: number;
  private sac: number;
  private tankV: number;
  private pDep: number;
  private gfLow: number;
  private gfHigh: number;
  private fO2Bottom: number;
  private fN2Bottom: number;
  private fO2Deco: number;
  private fN2Deco: number;
  private dt: number = 0.1;

  // ZH-L16C Coefficients
  private hl: number[] = [4.0, 5.0, 8.0, 12.5, 18.5, 27.0, 38.3, 54.3, 77.0, 109.0, 146.0, 187.0, 239.0, 305.0, 390.0, 498.0];
  private a: number[] = [1.2599, 1.0000, 0.8618, 0.7562, 0.6667, 0.5600, 0.4947, 0.4500, 0.4187, 0.3798, 0.3497, 0.3223, 0.2850, 0.2737, 0.2523, 0.2327];
  private b: number[] = [0.5050, 0.6314, 0.7222, 0.7825, 0.8126, 0.8434, 0.8693, 0.8910, 0.9092, 0.9222, 0.9319, 0.9403, 0.9477, 0.9544, 0.9602, 0.9653];

  private tissues: number[] = [0.79, 0.79, 0.79, 0.79, 0.79, 0.79, 0.79, 0.79, 0.79, 0.79, 0.79, 0.79, 0.79, 0.79, 0.79, 0.79];
  private log: DiveLog = {
    time: [],
    depth: [],
    tissues: [[], [], [], [], [], [], [], [], [], [], [], [], [], [], [], []],
    cons: 0,
    ppo2: []
  };

  constructor(
    depth: number,
    bottomTime: number,
    vUp: number,
    sac: number,
    tankV: number,
    pDep: number,
    gfLow: number,
    gfHigh: number,
    fO2Bottom: number,
    fO2Deco?: number
  ) {
    this.depth = depth;
    this.bottomTime = bottomTime;
    this.vUp = vUp;
    this.sac = sac;
    this.tankV = tankV;
    this.pDep = pDep;
    this.gfLow = gfLow / 100.0;
    this.gfHigh = gfHigh / 100.0;
    this.fO2Bottom = fO2Bottom / 100.0;
    this.fN2Bottom = 1.0 - this.fO2Bottom;
    this.fO2Deco = fO2Deco ? fO2Deco / 100.0 : this.fO2Bottom;
    this.fN2Deco = 1.0 - this.fO2Deco;
  }

  private update(d: number, t: number, isDeco: boolean = false): void {
    const pAmb = (d / 10.0) + 1.0;
    const fN2 = (isDeco && d <= this.getSwitchDepth()) ? this.fN2Deco : this.fN2Bottom;
    const fO2 = 1.0 - fN2;

    this.log.cons += this.sac * pAmb * this.dt;
    this.log.ppo2.push(pAmb * fO2);

    const pAlv = (pAmb - 0.0627) * fN2;
    for (let i = 0; i < 16; i++) {
      const k = Math.log(2) / this.hl[i];
      this.tissues[i] = pAlv + (this.tissues[i] - pAlv) * Math.exp(-k * this.dt);
      this.log.tissues[i].push(this.tissues[i]);
    }
    this.log.time.push(t);
    this.log.depth.push(d);
  }

  getSwitchDepth(): number {
    return (1.6 / this.fO2Deco - 1.0) * 10.0;
  }

  private getCeiling(currentDepth: number): number {
    const gfSlope = (this.gfHigh - this.gfLow) / (0 - this.depth);
    const currentGf = this.gfHigh + gfSlope * currentDepth;
    const ceilings: number[] = [];
    
    for (let i = 0; i < 16; i++) {
      const num = this.tissues[i] - this.a[i] * currentGf;
      const den = currentGf / this.b[i] + 1.0 - currentGf;
      ceilings.push(num / den);
    }
    return Math.max(0, (Math.max(...ceilings) - 1.0) * 10.0);
  }

  run(): DiveLog {
    let t = 0;
    let currD = 0.0;

    // 1. Descente (Descent)
    while (currD < this.depth) {
      this.update(currD, t);
      currD += 15.0 * this.dt;
      t += this.dt;
    }

    // 2. Fond (Bottom)
    const tEndBottom = t + this.bottomTime;
    while (t < tEndBottom) {
      this.update(this.depth, t);
      t += this.dt;
    }

    // 3. Remontée (Ascent)
    currD = this.depth;
    while (currD > 0) {
      const ceiling = this.getCeiling(currD);
      const nextStop = Math.ceil(ceiling / 3.0) * 3.0;
      
      if (currD > nextStop) {
        currD -= (this.vUp * this.dt);
        if (currD < nextStop) currD = nextStop;
      } else {
        currD = nextStop;
      }
      
      this.update(currD, t, true);
      t += this.dt;
      
      if (currD === 0 && this.getCeiling(0) <= 0) break;
    }

    return this.log;
  }
}

