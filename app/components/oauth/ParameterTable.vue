<script setup lang="ts">
defineProps<{
  items: Array<{ key: string, value: string }>
  title?: string
}>()

function copyValue(value: string) {
  navigator.clipboard.writeText(value)
}
</script>

<template>
  <div>
    <h4
      v-if="title"
      class="text-sm font-medium text-muted mb-2"
    >
      {{ title }}
    </h4>
    <div class="border border-default rounded-lg overflow-hidden divide-y divide-default">
      <div
        v-for="item in items"
        :key="item.key"
        class="flex items-start gap-3 px-3 py-2 text-sm"
      >
        <UBadge
          :label="item.key"
          color="neutral"
          variant="subtle"
          class="shrink-0 font-mono"
        />
        <span class="font-mono text-muted break-all flex-1 min-w-0">{{ item.value }}</span>
        <UButton
          icon="i-lucide-copy"
          size="xs"
          variant="ghost"
          color="neutral"
          class="shrink-0"
          @click="copyValue(item.value)"
        />
      </div>
    </div>
  </div>
</template>
