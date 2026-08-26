import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  FOUNDATION_STORIES,
  FOUNDATION_STORY_GROUPS,
  FOUNDATION_STORY_NAVIGATION_GROUPS,
  getFoundationStoriesByGroup,
  getFoundationStoriesByNavigationGroup,
  getFoundationStoryByViewId,
  getFoundationStoryLifecycle,
} from '../../src/shared/foundation-story-registry'
import { UI_COMPONENT_REGISTRY } from '../../src/shared/ui-component-registry'

const uiControlsSource = readFileSync('src/components/playground/UiControlsPanel.tsx', 'utf8')
const advancedSource = readFileSync('src/components/playground/FoundationAdvancedStories.tsx', 'utf8')

describe('Foundation story registry', () => {
  it('keeps story keys, views, assets and groups in one consistent relation', () => {
    const keys = FOUNDATION_STORIES.map((story) => story.key)
    const viewIds = FOUNDATION_STORIES.map((story) => story.viewId)

    expect(keys.length).toBeGreaterThan(20)
    expect(new Set(keys).size).toBe(keys.length)
    expect(new Set(viewIds).size).toBe(viewIds.length)
    expect(new Set(FOUNDATION_STORY_GROUPS.map((group) => group.id))).toEqual(new Set(FOUNDATION_STORIES.map((story) => story.group)))

    for (const story of FOUNDATION_STORIES) {
      const asset = UI_COMPONENT_REGISTRY[story.assetKey]
      expect(asset).toBeDefined()
      expect(asset.layer).toBe('foundation')
      expect(getFoundationStoryByViewId(story.viewId)).toBe(story)
      expect(['ui-controls', 'advanced']).toContain(story.renderer)
      expect(['candidate', 'playground', 'adopted', 'deprecated', 'archived']).toContain(getFoundationStoryLifecycle(story))

      const rendererSource = story.renderer === 'advanced' ? advancedSource : uiControlsSource
      const rendererMarker = story.renderer === 'advanced' ? `case '${story.key}'` : `effectiveSub === '${story.viewId}'`
      expect(rendererSource).toContain(rendererMarker)
    }
  })

  it('derives every group view without a second manual story list', () => {
    expect(FOUNDATION_STORY_GROUPS.flatMap((group) => getFoundationStoriesByGroup(group.id))).toEqual([...FOUNDATION_STORIES])
  })

  it('uses navigation groups to reduce tabs without deleting story coverage', () => {
    const navigationGroupIds = FOUNDATION_STORY_NAVIGATION_GROUPS.map((group) => group.id)
    expect(new Set(navigationGroupIds)).toEqual(new Set(FOUNDATION_STORIES.map((story) => story.navigationGroup)))
    for (const story of FOUNDATION_STORIES) {
      expect(navigationGroupIds).toContain(story.navigationGroup)
    }
    expect(
      FOUNDATION_STORY_NAVIGATION_GROUPS.flatMap((group) => getFoundationStoriesByNavigationGroup(group.id)).map((story) => story.key).sort(),
    ).toEqual(FOUNDATION_STORIES.map((story) => story.key).sort())
  })
})
