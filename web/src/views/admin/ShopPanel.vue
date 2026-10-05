<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { NButton, NInput, NInputNumber, NModal, NSelect, NSwitch, NTag, useMessage } from 'naive-ui';
import { api } from '../../api';

const message = useMessage();
const items = ref<any[]>([]);
const orders = ref<any[]>([]);
const editOpen = ref(false);
const saving = ref(false);
const grantOpen = ref(false);
const form = ref<any>({});
const grantForm = ref({ username: '', kind: 'problem', amount: 1, note: '' });

const kindOptions = [
  { label: '出题资格', value: 'problem' },
  { label: '办赛资格', value: 'contest' },
];

async function load() {
  items.value = (await api.get<any>('/api/admin/shop/items')).items ?? [];
  orders.value = (await api.get<any>('/api/admin/shop/orders?size=20')).items ?? [];
}

function create() {
  form.value = { name: '', slug: '', description: '', price: 100, kind: 'contest', grantAmount: 1, stock: -1, maxPerUser: 0, active: true, sort: 0 };
  editOpen.value = true;
}

function edit(row: any) {
  form.value = { ...row };
  editOpen.value = true;
}

async function save() {
  saving.value = true;
  try {
    const payload = {
      name: form.value.name,
      description: form.value.description ?? '',
      price: form.value.price,
      kind: form.value.kind,
      grantAmount: form.value.grantAmount,
      stock: form.value.stock,
      maxPerUser: form.value.maxPerUser,
      active: form.value.active,
      sort: form.value.sort,
      ...(form.value.slug ? { slug: form.value.slug } : {}),
    };
    if (form.value.id) await api.put(`/api/admin/shop/items/${form.value.id}`, payload);
    else await api.post('/api/admin/shop/items', payload);
    message.success('已保存');
    editOpen.value = false;
    await load();
  } catch (err: any) {
    message.error(err?.message ?? '保存失败');
  } finally {
    saving.value = false;
  }
}

async function offline(row: any) {
  await api.del(`/api/admin/shop/items/${row.id}`);
  message.success('已下架');
  await load();
}

async function grant() {
  try {
    await api.post('/api/admin/shop/grant', grantForm.value);
    message.success('已发放');
    grantOpen.value = false;
    grantForm.value = { username: '', kind: 'problem', amount: 1, note: '' };
  } catch (err: any) {
    message.error(err?.message ?? '发放失败');
  }
}

onMounted(load);
</script>

<template>
  <div class="space-y-4">
    <div class="jk-panel">
      <div class="jk-section">
        <h2>商品</h2>
        <span class="count">{{ items.length }}</span>
        <div style="display: flex; gap: 8px; margin-left: auto">
          <n-button size="small" @click="grantOpen = true">手动发资格</n-button>
          <n-button size="small" type="primary" @click="create">新建商品</n-button>
        </div>
      </div>
      <table class="jk-table">
        <thead>
          <tr>
            <th style="width: 60px">ID</th>
            <th>名称</th>
            <th style="width: 100px">类型</th>
            <th style="width: 90px">价格</th>
            <th style="width: 90px">发放</th>
            <th style="width: 90px">已兑</th>
            <th style="width: 90px">状态</th>
            <th style="width: 130px">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in items" :key="row.id">
            <td class="mono">{{ row.id }}</td>
            <td>{{ row.name }}<div class="mono" style="font-size: 11px; color: var(--jk-muted)">{{ row.slug }}</div></td>
            <td><n-tag size="tiny" :bordered="false">{{ row.kind === 'problem' ? '出题' : '办赛' }}</n-tag></td>
            <td class="mono">{{ row.price }}</td>
            <td class="mono">×{{ row.grantAmount }}</td>
            <td class="mono">{{ row.soldCount }}</td>
            <td><n-tag size="tiny" :type="row.active ? 'success' : 'default'" :bordered="false">{{ row.active ? '上架' : '下架' }}</n-tag></td>
            <td>
              <n-button size="tiny" text @click="edit(row)">编辑</n-button>
              <n-button v-if="row.active" size="tiny" text type="error" @click="offline(row)">下架</n-button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="jk-panel">
      <div class="jk-section"><h2>兑换记录</h2><span class="count">最近 {{ orders.length }} 条</span></div>
      <table class="jk-table">
        <thead>
          <tr>
            <th style="width: 190px">订单号</th>
            <th style="width: 150px">用户</th>
            <th>商品</th>
            <th style="width: 90px">花费</th>
            <th style="width: 170px">时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="o in orders" :key="o.id">
            <td class="mono" style="font-size: 12px">{{ o.orderNo }}</td>
            <td><RouterLink :to="`/users/${o.user.username}`" class="table-link">@{{ o.user.username }}</RouterLink></td>
            <td>{{ o.itemName }}</td>
            <td class="mono">{{ o.price }}</td>
            <td class="mono" style="font-size: 12px; color: var(--jk-muted)">{{ new Date(o.createdAt).toLocaleString() }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="!orders.length" style="font-size: 13px; color: var(--jk-muted)">还没有兑换记录</p>
    </div>

    <n-modal v-model:show="editOpen" preset="card" :title="form.id ? '编辑商品' : '新建商品'" style="max-width: 560px">
      <div class="admin-form">
        <label class="field"><span>名称</span><n-input v-model:value="form.name" /></label>
        <label class="field"><span>标识（留空自动生成）</span><n-input v-model:value="form.slug" placeholder="problem-1" /></label>
        <label class="field"><span>描述</span><n-input v-model:value="form.description" type="textarea" :autosize="{ minRows: 2, maxRows: 5 }" /></label>
        <label class="field"><span>类型</span><n-select v-model:value="form.kind" :options="kindOptions" /></label>
        <label class="field"><span>价格（积分）</span><n-input-number v-model:value="form.price" :min="0" style="width: 100%" /></label>
        <label class="field"><span>兑换发放次数</span><n-input-number v-model:value="form.grantAmount" :min="1" style="width: 100%" /></label>
        <label class="field"><span>库存（-1 不限）</span><n-input-number v-model:value="form.stock" :min="-1" style="width: 100%" /></label>
        <label class="field"><span>每人限购（0 不限）</span><n-input-number v-model:value="form.maxPerUser" :min="0" style="width: 100%" /></label>
        <label class="field"><span>排序</span><n-input-number v-model:value="form.sort" :min="0" style="width: 100%" /></label>
        <label class="field field-inline"><span>上架</span><n-switch v-model:value="form.active" /></label>
      </div>
      <template #footer>
        <div style="display: flex; justify-content: flex-end; gap: 8px">
          <n-button @click="editOpen = false">取消</n-button>
          <n-button type="primary" :loading="saving" @click="save">保存</n-button>
        </div>
      </template>
    </n-modal>

    <n-modal v-model:show="grantOpen" preset="card" title="手动发放资格" style="max-width: 460px">
      <div class="admin-form">
        <label class="field"><span>用户名</span><n-input v-model:value="grantForm.username" /></label>
        <label class="field"><span>类型</span><n-select v-model:value="grantForm.kind" :options="kindOptions" /></label>
        <label class="field"><span>数量</span><n-input-number v-model:value="grantForm.amount" :min="1" :max="100" style="width: 100%" /></label>
        <label class="field"><span>备注</span><n-input v-model:value="grantForm.note" /></label>
      </div>
      <template #footer>
        <div style="display: flex; justify-content: flex-end; gap: 8px">
          <n-button @click="grantOpen = false">取消</n-button>
          <n-button type="primary" @click="grant">发放</n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
.admin-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.field > span {
  font-size: 12.5px;
  color: var(--jk-text-2);
}

.field-inline {
  align-items: flex-start;
}
</style>
