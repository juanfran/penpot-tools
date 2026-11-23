import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Which comment pins the canvas shows. Resolved threads stay visible by default:
 *  they often still record decisions that matter for the implementation. */
export type CommentVisibility = 'all' | 'open' | 'hidden';
export const COMMENT_VISIBILITIES = ['all', 'open', 'hidden'] as const;

interface CommentsPrefsState {
  visibility: CommentVisibility;
  setVisibility: (v: CommentVisibility) => void;
}

export const useCommentsPrefs = create<CommentsPrefsState>()(
  persist(
    (set) => ({
      visibility: 'all',
      setVisibility: (visibility) => set({ visibility }),
    }),
    { name: 'comments-prefs' },
  ),
);
