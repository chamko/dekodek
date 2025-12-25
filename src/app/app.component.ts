import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, ChartConfiguration, ChartOptions } from 'chart.js';
import { DecoPlanner, DiveLog } from './deco-planner.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, AfterViewInit {
  @ViewChild('chartCanvas', { static: false }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  
  private chart: Chart<'line'> | null = null;

  // Input parameters
  fO2Bottom: number = 32;
  fO2Deco: number | null = null;
  profMax: number = 40;
  tFond: number = 20;
  gfLow: number = 30;
  gfHigh: number = 70;
  sac: number = 19.0;
  volBloc: number = 15;

  // Calculated values
  mod: number = 0;
  maxDepth: number = 0;
  diveLog: DiveLog | null = null;
  totalTime: number = 0;
  finalPressure: number = 0;
  maxPPO2: number = 0;

  // Chart configuration
  private getChartOptions(): ChartOptions<'line'> {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      scales: {
        y: {
          reverse: true,
          title: {
            display: true,
            text: 'Profondeur (m)'
          },
          beginAtZero: true
        },
        x: {
          type: 'linear',
          title: {
            display: true,
            text: 'Temps (min)'
          },
          beginAtZero: true
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          enabled: true
        }
      }
    };
  }

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.calculate();
  }

  ngAfterViewInit(): void {
    // Use setTimeout to ensure the view is fully rendered
    setTimeout(() => {
      this.updateChart();
    }, 100);
  }

  calculate(): void {
    // Calculate MOD
    this.mod = (1.6 / (this.fO2Bottom / 100) - 1.0) * 10.0;
    this.maxDepth = Math.min(40, Math.floor(this.mod));
    
    // Ensure profMax doesn't exceed MOD
    if (this.profMax > this.mod) {
      this.profMax = this.maxDepth;
    }

    // Create planner and run calculation
    const planner = new DecoPlanner(
      this.profMax,
      this.tFond,
      10, // v_up
      this.sac,
      this.volBloc,
      200, // p_dep
      this.gfLow,
      this.gfHigh,
      this.fO2Bottom,
      this.fO2Deco || undefined
    );

    this.diveLog = planner.run();

    // Calculate metrics
    if (this.diveLog && this.diveLog.time.length > 0) {
      this.totalTime = Math.round(this.diveLog.time[this.diveLog.time.length - 1] * 10) / 10;
      this.finalPressure = Math.floor(200 - (this.diveLog.cons / this.volBloc));
      this.maxPPO2 = Math.round(Math.max(...this.diveLog.ppo2) * 100) / 100;
    }

    // Update chart - will be called after view init if canvas is ready
    if (this.chartCanvas) {
      this.updateChart();
    }
  }

  private updateChart(): void {
    if (!this.diveLog) {
      console.log('No dive log data available');
      return;
    }

    // Wait for canvas to be available
    if (!this.chartCanvas || !this.chartCanvas.nativeElement) {
      console.log('Canvas not ready, retrying...');
      setTimeout(() => this.updateChart(), 50);
      return;
    }

    console.log('Updating chart with', this.diveLog.time.length, 'data points');

    // Prepare data points as simple arrays for better Chart.js compatibility
    const timeData = this.diveLog.time;
    const depthData = this.diveLog.depth;

    // Create data points array
    const dataPoints = depthData.map((d, i) => ({ x: timeData[i], y: d }));

    const datasets: any[] = [
      {
        label: 'Profil',
        data: dataPoints,
        borderColor: 'rgb(6, 182, 212)',
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        borderWidth: 3,
        pointRadius: 0,
        pointHoverRadius: 4,
        fill: false,
        tension: 0,
        parsing: false
      }
    ];

    // Add deco gas switch line if deco gas is used
    if (this.fO2Deco && this.diveLog) {
      const switchDepth = (1.6 / (this.fO2Deco / 100) - 1.0) * 10.0;
      const switchIdx = this.diveLog.depth.findIndex(
        (d, i) => d <= switchDepth && i > this.diveLog!.depth.length / 2
      );

      if (switchIdx > 0 && switchIdx < this.diveLog.depth.length) {
        datasets.push({
          label: `Switch EAN${this.fO2Deco}`,
          data: this.diveLog.depth.slice(switchIdx).map((d, i) => ({
            x: this.diveLog!.time[switchIdx + i],
            y: d
          })),
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          borderWidth: 4,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: false,
          tension: 0
        });
      }
    }

    const chartData: ChartConfiguration<'line'>['data'] = {
      datasets: datasets
    };

    // Destroy existing chart if it exists
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }

    // Ensure canvas is ready
    if (!this.chartCanvas.nativeElement) {
      console.error('Chart canvas not available');
      return;
    }

    try {
      // Ensure canvas has proper context
      const ctx = this.chartCanvas.nativeElement.getContext('2d');
      if (!ctx) {
        console.error('Could not get canvas context');
        return;
      }

      // Create new chart
      this.chart = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: this.getChartOptions()
      });
      
      console.log('Chart created successfully');
    } catch (error) {
      console.error('Error creating chart:', error);
    }
  }

  onInputChange(): void {
    this.calculate();
  }
}

