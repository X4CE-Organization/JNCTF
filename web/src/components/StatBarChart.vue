<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

const props = defineProps<{
  items: Array<{ name: string; value: number; color?: string | null }>;
  label?: string;
}>();

const el = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;

function cssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function render() {
  if (!el.value) return;
  if (!chart) chart = echarts.init(el.value, undefined, { renderer: 'canvas' });
  const text = cssVar('--jk-text', '#0b0f19');
  const muted = cssVar('--jk-muted', '#7b8399');
  const border = cssVar('--jk-border-strong', 'rgba(11,15,25,0.2)');
  const accent = cssVar('--jk-accent', '#00a878');

  chart.setOption(
    {
      grid: { left: 8, right: 16, top: 24, bottom: 4, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: cssVar('--jk-bg-elev', '#fff'),
        borderColor: border,
        textStyle: { color: text, fontSize: 12 },
      },
      xAxis: {
        type: 'category',
        data: props.items.map((i) => i.name),
        axisLine: { lineStyle: { color: border } },
        axisTick: { show: false },
        axisLabel: { color: muted, fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        splitLine: { lineStyle: { color: border, type: 'dashed' } },
        axisLabel: { color: muted, fontSize: 11 },
      },
      series: [
        {
          type: 'bar',
          barMaxWidth: 34,
          data: props.items.map((i) => ({
            value: i.value,
            itemStyle: { color: i.color || accent, borderRadius: [3, 3, 0, 0] },
          })),
        },
      ],
    },
    true,
  );
}

function onResize() {
  chart?.resize();
}

onMounted(() => {
  render();
  window.addEventListener('resize', onResize);
  window.addEventListener('jnctf-theme', render);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
  window.removeEventListener('jnctf-theme', render);
  chart?.dispose();
  chart = null;
});

watch(() => props.items, render, { deep: true });
</script>

<template>
  <div ref="el" class="stat-chart" :aria-label="label ?? '统计图'" />
</template>

<style scoped>
.stat-chart {
  width: 100%;
  height: 220px;
}
</style>
