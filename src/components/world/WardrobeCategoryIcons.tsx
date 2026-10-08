import type { ReactNode } from 'react'
import hanger from '../../assets/icons/wardrobe/phosphor-coat-hanger.svg'
import pants from '../../assets/icons/wardrobe/phosphor-pants.svg'
import hoodie from '../../assets/icons/wardrobe/phosphor-hoodie.svg'

export const wardrobeCategoryIcons: Readonly<Record<string, ReactNode>> = Object.fromEntries(Object.entries({ outfits: hanger, bottom: pants, outerwear: hoodie }).map(([id, src]) => [id,
  <span key={id} aria-hidden="true" data-wardrobe-icon="mixed" data-icon-slot={id} className="block h-[14px] w-[14px] shrink-0" style={{ backgroundColor: 'currentColor', maskImage: `url("${src}")`, maskRepeat: 'no-repeat', maskPosition: 'center', maskSize: 'contain' }} />,
]))
