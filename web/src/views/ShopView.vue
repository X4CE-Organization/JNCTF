<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { NButton, NSpin, NTag, useDialog, useMessage } from 'naive-ui';
import { RouterLink, useRouter } from 'vue-router';
import { api } from '../api';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const message = useMessage();
const dialog = useDialog();
const router = useRouter();

const loading = ref(true);
const items = ref<any[]>([]);
const points = ref(0);
const quota = ref<any>({ problem: { remaining: 0 }, contest: { remaining: 0 } });
const orders = ref<any[]>([]);
const title = ref('积分商店');
const notice = ref('');
const enabled = ref(true);
const redeeming = ref<string | null>(null);

const KIND_LABEL: Record<string, string> = { problem: '出题资格', contest: '办赛资格' };

async function load() {
  loading.value = true;
  try {
    const data = await api.get<any>('/api/shop/items');
    items.value = data.items ?? [];
    points.value = data.points ?? 0;
    quota.value = data.quota ?? quota.value;
    title.value = data.title ?? '积分商店';
    notice.value = data.notice ?? '';
    enabled.value = data.enabled !== false;
    if (auth.isLogin) {
      orders.value = (await api.get<any>('/api/shop/orders?size=10').catch(() => ({ items: [] }))).items ?? [];
      await auth.refresh();
    }
  } finally {
    loading.value = false;
  }
}

function redeem(item: any) {
  if (!auth.isLogin) {
    router.push('/login');
    return;
  }
  dialog.warning({
    title: '确认兑换',
    content: `用 ${item.price} 积分兑换「${item.name}」？兑换后立刻扣积分。`,
    positiveText: '兑换',
    negativeText: '再想想',
    onPositiveClick: async () => {
      redeeming.value = item.slug;
      try {
        const data = await api.post<any>('/api/shop/redeem', { itemId: item.id });
        message.success(`兑换成功，已到账 ${data.grantAmount} 次${KIND_LABEL[data.kind] ?? ''}`);
        await load();
      } catch (err: any) {
        message.error(err?.message ?? '兑换失败');
      } finally {
        redeeming.value = null;
      }
    },
  });
}

const canCreate = computed(() => (quota.value?.problem?.remaining ?? 0) + (quota.value?.contest?.remaining ?? 0));

onMounted(load);
</script>

<template>
  <n-spin :show="loading">
    <div class="jk-page">
      <header class="jk-head">
        <button class="back-btn" title="返回上一页" @click="router.back()">←</button>
        <span class="jk-head-icon">🛒</span>
        <div style="min-width: 0">
          <h1>{{ title }}</h1>
          <p><span>{{ notice || '做一题得一点积分，攒够了来这里换资格' }}</span></p>
        </div>
        <div class="jk-head-actions">
          <div class="shop-wallet">
            <div class="wallet-item">
              <span class="wallet-label">我的积分</span>
              <b class="wallet-value">{{ points }}</b>
            </div>
            <div class="wallet-item">
              <span class="wallet-label">等级分</span>
              <b class="wallet-value alt">{{ auth.user?.score ?? 0 }}</b>
            </div>
          </div>
        </div>
      </header>

      <section v-if="auth.isLogin" class="jk-panel">
        <div class="jk-section"><h2>我的资格</h2></div>
        <div class="quota-row">
          <div class="quota-card">
            <span>出题资格</span>
            <b>{{ quota?.problem?.remaining ?? 0 }}</b>
            <small>已用 {{ quota?.problem?.used ?? 0 }} / 共 {{ quota?.problem?.total ?? 0 }}</small>
          </div>
          <div class="quota-card">
            <span>办赛资格</span>
            <b>{{ quota?.contest?.remaining ?? 0 }}</b>
            <small>已用 {{ quota?.contest?.used ?? 0 }} / 共 {{ quota?.contest?.total ?? 0 }}</small>
          </div>
          <div class="quota-card quota-action">
            <span>兑换之后</span>
            <n-button size="small" :disabled="canCreate === 0" @click="router.push('/creation')">去创作中心使用</n-button>
          </div>
        </div>
      </section>

      <section v-else class="jk-panel">
        <p style="margin: 0; font-size: 13px; color: var(--jk-muted)">
          <RouterLink to="/login" style="color: var(--jk-accent)">登录</RouterLink>
          后可以查看自己的积分并兑换商品。
        </p>
      </section>

      <section class="jk-panel">
        <div class="jk-section"><h2>商品</h2><span class="count">{{ items.length }}</span></div>
        <div v-if="!items.length" class="jk-empty">
          <div class="jk-empty-icon">□</div>
          <div>// 商店暂时没有上架商品</div>
        </div>
        <div class="shop-grid">
          <div v-for="item in items" :key="item.id" class="shop-card">
            <div class="shop-card-head">
              <span class="shop-icon">{{ item.kind === 'problem' ? '🚩' : '🏆' }}</span>
              <n-tag size="tiny" :bordered="false">{{ KIND_LABEL[item.kind] ?? item.kind }}</n-tag>
              <n-tag v-if="item.grantAmount > 1" size="tiny" type="success" :bordered="false">×{{ item.grantAmount }}</n-tag>
            </div>
            <h3>{{ item.name }}</h3>
            <p>{{ item.description }}</p>
            <div class="shop-card-foot">
              <div class="shop-price">
                <b>{{ item.price }}</b>
                <span>积分</span>
              </div>
              <div class="shop-stock">
                <span v-if="item.stockLeft >= 0">剩余 {{ item.stockLeft }}</span>
                <span v-else>不限量</span>
                <span v-if="item.perUserLeft >= 0"> · 还可兑换 {{ item.perUserLeft }}</span>
              </div>
            </div>
            <n-button
              block
              size="small"
              :type="item.affordable ? 'primary' : 'default'"
              :disabled="item.soldOut || !enabled"
              :loading="redeeming === item.slug"
              @click="redeem(item)"
            >
              {{ item.soldOut ? '已兑完' : item.affordable ? '兑换' : '积分不足' }}
            </n-button>
          </div>
        </div>
      </section>

      <section v-if="auth.isLogin && orders.length" class="jk-panel">
        <div class="jk-section"><h2>兑换记录</h2><span class="count">{{ orders.length }}</span></div>
        <table class="jk-table">
          <thead>
            <tr>
              <th style="width: 190px">订单号</th>
              <th>商品</th>
              <th style="width: 110px">花费</th>
              <th style="width: 180px">时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="o in orders" :key="o.id">
              <td class="mono" style="font-size: 12px">{{ o.orderNo }}</td>
              <td>{{ o.itemName }}</td>
              <td class="mono">{{ o.price }}</td>
              <td class="mono" style="font-size: 12px; color: var(--jk-muted)">{{ new Date(o.createdAt).toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </n-spin>
</template>

<style scoped>
.shop-wallet {
  display: flex;
  gap: 18px;
}

.wallet-item {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.wallet-label {
  font-size: 11px;
  color: var(--jk-muted);
}

.wallet-value {
  font-family: var(--jk-mono);
  font-size: 20px;
  color: var(--jk-accent);
}

.wallet-value.alt {
  color: var(--jk-amber);
}

.quota-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.quota-card {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 14px;
  border: 1px solid var(--jk-border);
  border-radius: 6px;
  background: var(--jk-bg-soft);
}

.quota-card span {
  font-size: 12.5px;
  color: var(--jk-muted);
}

.quota-card b {
  font-family: var(--jk-mono);
  font-size: 24px;
  color: var(--jk-accent);
}

.quota-card small {
  font-size: 11.5px;
  color: var(--jk-muted);
}

.quota-action {
  justify-content: center;
  align-items: flex-start;
}

.shop-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
}

.shop-card {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 16px;
  border: 1px solid var(--jk-border);
  border-radius: 8px;
  background: var(--jk-bg-soft);
}

.shop-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.shop-icon {
  font-size: 20px;
}

.shop-card h3 {
  margin: 0;
  font-size: 15px;
}

.shop-card p {
  margin: 0;
  flex: 1;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--jk-muted);
}

.shop-card-foot {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}

.shop-price b {
  font-family: var(--jk-mono);
  font-size: 22px;
  color: var(--jk-accent);
}

.shop-price span {
  margin-left: 3px;
  font-size: 12px;
  color: var(--jk-muted);
}

.shop-stock {
  font-size: 11px;
  color: var(--jk-muted);
}
</style>
