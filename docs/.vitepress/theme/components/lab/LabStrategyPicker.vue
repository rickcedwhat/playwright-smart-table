<template>
  <div class="lab-picker">
    <div class="flow">
      <LabFeedbackMark slug="strategy-picker.flow" label="Decision flow" compact />
      <div class="node">Row already on screen?</div>
      <div class="arrow">yes →</div>
      <div class="node highlight">getRow</div>
    </div>
    <div class="flow">
      <div class="node muted">no</div>
      <div class="arrow">→</div>
      <div class="node">Need one match across pages?</div>
      <div class="arrow">→</div>
      <div class="node highlight">findRow + pagination</div>
    </div>
    <div class="flow">
      <div class="node">Need every match?</div>
      <div class="arrow">→</div>
      <div class="node highlight">findRows</div>
    </div>
    <div class="flow">
      <div class="node">Need all rows in order?</div>
      <div class="arrow">→</div>
      <div class="node highlight">map / forEach</div>
    </div>
  </div>
</template>

<style scoped>
.lab-picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 20px 0;
  padding: 16px;
  border-radius: 14px;
  border: 1px solid var(--vp-c-divider);
}
.flow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 0.88rem;
}
.node {
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
}
.node.highlight {
  border-color: var(--vp-c-brand-1);
  background: color-mix(in srgb, var(--vp-c-brand-1) 12%, var(--vp-c-bg-soft));
  font-weight: 600;
}
.node.muted {
  opacity: 0.75;
}
.arrow {
  color: var(--vp-c-text-2);
  font-size: 0.8rem;
}
</style>
