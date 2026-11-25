<script setup>
const records = [
  { name: '2024年9月 · 生产制造', type: '范围一', value: '428.60', date: '2024/09/30', status: '已完成' },
  { name: '2024年9月 · 外购电力', type: '范围二', value: '312.48', date: '2024/09/30', status: '已完成' },
  { name: '2024年9月 · 员工通勤', type: '范围三', value: '86.24', date: '2024/09/28', status: '待审核' }
]
</script>

<template>
  <section class="surface-card records-card">
    <div class="card-heading">
      <div><p class="card-kicker">RECENT RECORDS</p><h2>最近核算记录</h2></div>
      <button class="text-button">查看全部 <span>→</span></button>
    </div>
    <div class="records-table">
      <div class="table-row table-head"><span>核算名称</span><span>排放范围</span><span>排放量</span><span>核算日期</span><span>状态</span><span></span></div>
      <div v-for="record in records" :key="record.name" class="table-row">
        <strong>{{ record.name }}</strong><span class="scope-tag">{{ record.type }}</span><span>{{ record.value }} tCO₂e</span><span>{{ record.date }}</span><span :class="['status-tag', record.status === '已完成' ? 'done' : 'pending']">{{ record.status }}</span><button class="row-more">···</button>
      </div>
    </div>
  </section>
</template>
