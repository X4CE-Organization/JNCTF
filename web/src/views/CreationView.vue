<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { NButton, NDatePicker, NInput, NInputNumber, NSelect, NSpin, NTag, useMessage, useDialog } from 'naive-ui';
import { RouterLink, useRouter } from 'vue-router';
import { api } from '../api';
import { useAuthStore } from '../stores/auth';
import { DIFFICULTY_META } from '../theme';

const auth = useAuthStore();
const message = useMessage();
const dialog = useDialog();
const router = useRouter();

const loading = ref(true);
const overview = ref<any>({ problem: { remaining: 0 }, contest: { remaining: 0 } });
const challenges = ref<any[]>([]);
const competitions = ref<any[]>([]);
const categories = ref<Array<{ id: number; name: string }>>([]);
const tab = ref<'challenge' | 'competition'>('challenge');

const challengeForm = ref({
  title: '',
  description: '',
  difficulty: 'EASY',
  categoryId: null as number | null,
  score: 100,
  flag: '',
  tags: '',
});
const competitionForm = ref({
  name: '',
  slug: '',
  subtitle: '',
  description: '',
  startAt: '',
  endAt: '',
  maxTeamSize: 4,
});
const submitting = ref(false);

const difficultyOptions = Object.entries(DIFFICULTY_META).map(([value, meta]) => ({ label: meta.label, value }));

async function load() {
  loading.value = true;
  try {
    overview.value = await api.get<any>('/api/creation/overview');
    challenges.value = (await api.get<any>('/api/creation/challenges')).items ?? [];
    competitions.value = (await api.get<any>('/api/creation/competitions')).items ?? [];
    categories.value = auth.categories;
  } finally {
    loading.value = false;
  }
}

async function createChallenge() {
  if (!challengeForm.value.title.trim()) {
    message.warning('给题目起个名字');
    return;
  }
  if (!challengeForm.value.flag.trim()) {
    message.warning('至少要填一个 flag');
    return;
  }
  submitting.value = true;
  try {
    await api.post('/api/creation/challenges', {
      title: challengeForm.value.title.trim(),
      description: challengeForm.value.description,
      difficulty: challengeForm.value.difficulty,
      categoryId: challengeForm.value.categoryId,
      score: challengeForm.value.score,
      flags: [{ flag: challengeForm.value.flag.trim() }],
      tags: challengeForm.value.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    });
    message.success('题目已发布');
    challengeForm.value = { title: '', description: '', difficulty: 'EASY', categoryId: null, score: 100, flag: '', tags: '' };
    await load();
  } catch (err: any) {
    message.error(err?.message ?? '发布失败');
  } finally {
    submitting.value = false;
  }
}

async function createCompetition() {
  const f = competitionForm.value;
  if (!f.name.trim() || !f.slug.trim()) {
    message.warning('名称和标识都要填');
    return;
  }
  if (!f.startAt || !f.endAt) {
    message.warning('请填写开始与结束时间');
    return;
  }
  submitting.value = true;
  try {
    const result = await api.post<any>('/api/creation/competitions', {
      name: f.name.trim(),
      slug: f.slug.trim(),
      subtitle: f.subtitle,
      description: f.description,
      startAt: f.startAt,
      endAt: f.endAt,
      maxTeamSize: f.maxTeamSize,
      published: true,
    });
    message.success('比赛已创建');
    competitionForm.value = { name: '', slug: '', subtitle: '', description: '', startAt: '', endAt: '', maxTeamSize: 4 };
    await load();
    router.push(`/competitions/${result.slug}`);
  } catch (err: any) {
    message.error(err?.message ?? '创建失败');
  } finally {
    submitting.value = false;
  }
}

function removeChallenge(row: any) {
  dialog.warning({
    title: '删除题目',
    content: `确定删除「${row.title}」吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await api.del(`/api/creation/challenges/${row.id}`);
        message.success('已删除');
        await load();
      } catch (err: any) {
        message.error(err?.message ?? '删除失败');
      }
    },
  });
}

onMounted(load);
</script>

<template>
  <n-spin :show="loading">
    <div class="jk-page">
      <header class="jk-head">
        <button class="back-btn" title="返回上一页" @click="router.back()">←</button>
        <span class="jk-head-icon">⚒</span>
        <div style="min-width: 0">
          <h1>创作中心</h1>
          <p><span>用积分换来的资格出题、办赛</span></p>
        </div>
        <div class="jk-head-actions">
          <div class="shop-wallet">
            <div class="wallet-item">
              <span class="wallet-label">出题资格</span>
              <b class="wallet-value">{{ overview.problem?.remaining ?? 0 }}</b>
            </div>
            <div class="wallet-item">
              <span class="wallet-label">办赛资格</span>
              <b class="wallet-value">{{ overview.contest?.remaining ?? 0 }}</b>
            </div>
          </div>
        </div>
      </header>

      <div class="seg creation-tabs">
        <button :class="tab === 'challenge' ? 'on' : ''" @click="tab = 'challenge'">出题</button>
        <button :class="tab === 'competition' ? 'on' : ''" @click="tab = 'competition'">办赛</button>
      </div>

      <!-- 出题 -->
      <template v-if="tab === 'challenge'">
        <section class="jk-panel">
          <div class="jk-section">
            <h2>创建题目</h2>
            <span v-if="!overview.canCreateChallenge" class="count">
              需要出题资格，<RouterLink to="/shop" style="color: var(--jk-accent)">去商店兑换</RouterLink>
            </span>
          </div>
          <div class="create-grid">
            <label class="field"><span>标题</span><n-input v-model:value="challengeForm.title" placeholder="题目名称" maxlength="160" /></label>
            <label class="field"><span>难度</span><n-select v-model:value="challengeForm.difficulty" :options="difficultyOptions" /></label>
            <label class="field">
              <span>分类</span>
              <n-select
                v-model:value="challengeForm.categoryId"
                :options="categories.map((c) => ({ label: c.name, value: c.id }))"
                clearable
                placeholder="选择分类"
              />
            </label>
            <label class="field"><span>分值</span><n-input-number v-model:value="challengeForm.score" :min="1" :max="10000" style="width: 100%" /></label>
            <label class="field field-wide"><span>Flag</span><n-input v-model:value="challengeForm.flag" placeholder="flag{...}" /></label>
            <label class="field field-wide"><span>标签（逗号分隔）</span><n-input v-model:value="challengeForm.tags" placeholder="web,sql" /></label>
            <label class="field field-wide">
              <span>题目描述（Markdown）</span>
              <n-input v-model:value="challengeForm.description" type="textarea" :autosize="{ minRows: 6, maxRows: 18 }" />
            </label>
          </div>
          <div class="create-footer">
            <n-button type="primary" :loading="submitting" :disabled="!overview.canCreateChallenge" @click="createChallenge">
              发布题目
            </n-button>
          </div>
        </section>

        <section class="jk-panel">
          <div class="jk-section"><h2>我出的题</h2><span class="count">{{ challenges.length }}</span></div>
          <div v-if="!challenges.length" class="jk-empty" style="padding: 20px; border: none">
            <div class="mono" style="font-size: 12px">// 还没有出过题</div>
          </div>
          <div v-for="c in challenges" :key="c.id" class="jk-list-item">
            <span class="mono" style="color: var(--jk-muted)">#{{ c.id }}</span>
            <RouterLink :to="`/challenges/${c.id}`" class="table-link" style="flex: 1; min-width: 0">{{ c.title }}</RouterLink>
            <n-tag size="tiny" :bordered="false">{{ DIFFICULTY_META[c.difficulty]?.label ?? c.difficulty }}</n-tag>
            <span class="mono" style="font-size: 12px; color: var(--jk-muted)">{{ c.solveTotal }} 人解出</span>
            <n-button size="tiny" text type="error" @click="removeChallenge(c)">删除</n-button>
          </div>
        </section>
      </template>

      <!-- 办赛 -->
      <template v-else>
        <section class="jk-panel">
          <div class="jk-section">
            <h2>创建比赛</h2>
            <span v-if="!overview.canCreateCompetition" class="count">
              需要办赛资格，<RouterLink to="/shop" style="color: var(--jk-accent)">去商店兑换</RouterLink>
            </span>
          </div>
          <div class="create-grid">
            <label class="field"><span>比赛名称</span><n-input v-model:value="competitionForm.name" maxlength="160" /></label>
            <label class="field"><span>标识（URL）</span><n-input v-model:value="competitionForm.slug" placeholder="myctf2026" maxlength="16" /></label>
            <label class="field field-wide"><span>副标题</span><n-input v-model:value="competitionForm.subtitle" maxlength="255" /></label>
            <label class="field">
              <span>开始时间</span>
              <n-date-picker
                v-model:formatted-value="competitionForm.startAt"
                type="datetime"
                value-format="yyyy-MM-dd'T'HH:mm"
                clearable
                style="width: 100%"
              />
            </label>
            <label class="field">
              <span>结束时间</span>
              <n-date-picker
                v-model:formatted-value="competitionForm.endAt"
                type="datetime"
                value-format="yyyy-MM-dd'T'HH:mm"
                clearable
                style="width: 100%"
              />
            </label>
            <label class="field"><span>队伍人数上限</span><n-input-number v-model:value="competitionForm.maxTeamSize" :min="1" :max="50" style="width: 100%" /></label>
            <label class="field field-wide">
              <span>比赛说明（Markdown）</span>
              <n-input v-model:value="competitionForm.description" type="textarea" :autosize="{ minRows: 5, maxRows: 14 }" />
            </label>
          </div>
          <div class="create-footer">
            <n-button type="primary" :loading="submitting" :disabled="!overview.canCreateCompetition" @click="createCompetition">
              创建比赛
            </n-button>
          </div>
        </section>

        <section class="jk-panel">
          <div class="jk-section"><h2>我办的比赛</h2><span class="count">{{ competitions.length }}</span></div>
          <div v-if="!competitions.length" class="jk-empty" style="padding: 20px; border: none">
            <div class="mono" style="font-size: 12px">// 还没有办过比赛</div>
          </div>
          <div v-for="c in competitions" :key="c.id" class="jk-list-item">
            <RouterLink :to="`/competitions/${c.slug}`" class="table-link" style="flex: 1; min-width: 0">{{ c.name }}</RouterLink>
            <n-tag size="tiny" :bordered="false">{{ c.participantCount }} 人报名 · {{ c.challengeCount }} 题</n-tag>
            <span class="mono" style="font-size: 12px; color: var(--jk-muted)">
              {{ new Date(c.startAt).toLocaleDateString() }} 起
            </span>
          </div>
        </section>
      </template>
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

.creation-tabs {
  display: inline-flex;
  padding: 3px;
  border-radius: 6px;
  background: var(--jk-bg-soft);
  align-self: flex-start;
}

.creation-tabs button {
  padding: 7px 22px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--jk-text-2);
  font-size: 13.5px;
  cursor: pointer;
}

.creation-tabs button.on {
  background: var(--jk-bg-elev);
  color: var(--jk-accent);
  font-weight: 600;
  box-shadow: var(--jk-shadow-sm);
}

.create-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field > span {
  font-size: 12.5px;
  color: var(--jk-text-2);
}

.field-wide {
  grid-column: 1 / -1;
}

.create-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
