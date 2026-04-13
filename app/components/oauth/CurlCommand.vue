<script setup lang="ts">
const props = defineProps<{
  command: string
}>()

const collapsed = ref(true)

function copyToClipboard() {
  navigator.clipboard.writeText(props.command)
}
</script>

<template>
  <div class="border border-default rounded-lg overflow-hidden">
    <button
      class="flex items-center justify-between w-full px-3 py-2 text-sm font-medium bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
      @click="collapsed = !collapsed"
    >
      <span class="flex items-center gap-2">
        <UIcon name="i-lucide-terminal" class="text-muted" />
        cURL Command
      </span>
      <UIcon
        :name="collapsed ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
        class="text-muted"
      />
    </button>
    <div v-if="!collapsed" class="relative">
      <pre class="p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all select-all bg-gray-950 text-gray-200">{{ command }}</pre>
      <UButton
        icon="i-lucide-copy"
        variant="ghost"
        color="neutral"
        size="xs"
        class="absolute top-2 right-2"
        @click="copyToClipboard"
      />
    </div>
  </div>
</template>
