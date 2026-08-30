/**
 * Playground 产品体验旅程夹具：只承载可切换的演示主角，不读取生产角色或写入 activeRoleId。
 * 设计意图：让 Chat、人物世界和设置中的角色架共享同一份隔离状态，验证“当前主角”这一产品不变量。
 */

export interface PlaygroundPersona {
  id: string
  name: string
  blurb: string
  detail: string
}

export const PLAYGROUND_PERSONAS: readonly PlaygroundPersona[] = [
  {
    id: 'lin',
    name: '小林',
    blurb: '沉稳体贴的数字伙伴',
    detail: '会把事情理清，也会给生活留一点空白。',
  },
  {
    id: 'yao',
    name: '阿遥',
    blurb: '敏锐松弛的同行者',
    detail: '喜欢从日常里捡起一个值得继续想的片段。',
  },
] as const

export function findPlaygroundPersona(id: string): PlaygroundPersona {
  return PLAYGROUND_PERSONAS.find((persona) => persona.id === id) ?? PLAYGROUND_PERSONAS[0]
}
