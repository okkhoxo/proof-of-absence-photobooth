// 메모리에 이미지 임시 저장 (실제 배포 시에는 DB나 스토리지 사용)
export const imageStore = new Map<string, Buffer>()

// 이미지 자동 정리 (10분 후 삭제)
export function scheduleImageCleanup(id: string) {
  setTimeout(() => {
    imageStore.delete(id)
    console.log(`Image ${id} deleted from memory`)
  }, 10 * 60 * 1000) // 10분
}
