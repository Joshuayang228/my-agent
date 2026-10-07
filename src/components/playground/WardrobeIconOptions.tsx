import type { ReactNode } from 'react'
import { PlaygroundStateSwitcher } from './PlaygroundLayout'
import phosphorOutfits from '../../assets/playground/wardrobe-icons/phosphor-coat-hanger.svg'
import phosphorTop from '../../assets/playground/wardrobe-icons/phosphor-t-shirt.svg'
import phosphorBottom from '../../assets/playground/wardrobe-icons/phosphor-pants.svg'
import phosphorOuterwear from '../../assets/playground/wardrobe-icons/phosphor-hoodie.svg'
import phosphorShoes from '../../assets/playground/wardrobe-icons/phosphor-sneaker.svg'
import iconparkOutfits from '../../assets/playground/wardrobe-icons/iconpark-clothes-suit.svg'
import iconparkTop from '../../assets/playground/wardrobe-icons/iconpark-clothes-short-sleeve.svg'
import iconparkBottom from '../../assets/playground/wardrobe-icons/iconpark-clothes-pants.svg'
import iconparkOuterwear from '../../assets/playground/wardrobe-icons/iconpark-clothes-windbreaker.svg'
import iconparkShoes from '../../assets/playground/wardrobe-icons/iconpark-boots.svg'

export type WardrobeIconStyle = 'original' | 'phosphor' | 'iconpark' | 'mixed'
const sources = {
  phosphor: { outfits: phosphorOutfits, top: phosphorTop, bottom: phosphorBottom, outerwear: phosphorOuterwear, shoes: phosphorShoes },
  iconpark: { outfits: iconparkOutfits, top: iconparkTop, bottom: iconparkBottom, outerwear: iconparkOuterwear, shoes: iconparkShoes },
  mixed: { outfits: phosphorOutfits, bottom: phosphorBottom, outerwear: phosphorOuterwear },
}

/**
 * 背景：Lucide 缺少裤子等服装形状，需要在真实标签尺寸里对照外部图库。
 * 设计意图：只注入已审阅的静态素材，以 alpha mask 继承文字色，不安装归档库或复制基础标签。
 * 关键约束：限 Playground 显式 props；14px 槽位常驻，切换不重挂衣柜、不写配置，不使用远程 URL。
 */
export function wardrobePreviewIcons(style: WardrobeIconStyle): Readonly<Record<string, ReactNode>> | undefined {
  if (style === 'original') return undefined
  return Object.fromEntries(Object.entries(sources[style]).map(([id, src]) => [id,
    <span key={id} aria-hidden="true" data-wardrobe-icon={style} data-icon-slot={id}
      className="block h-[14px] w-[14px] shrink-0" style={{ backgroundColor: 'currentColor',
        maskImage: `url("${src}")`, maskRepeat: 'no-repeat', maskPosition: 'center', maskSize: 'contain' }} />,
  ]))
}

export function WardrobeIconOptions({ value, onChange }: { value: WardrobeIconStyle; onChange: (value: WardrobeIconStyle) => void }) {
  return <PlaygroundStateSwitcher ariaLabel="衣柜图标对照" value={value} onChange={onChange} items={[
    { id: 'mixed', label: '选定组合' }, { id: 'original', label: '原图标' }, { id: 'phosphor', label: 'Phosphor' }, { id: 'iconpark', label: 'IconPark' },
  ]} />
}
