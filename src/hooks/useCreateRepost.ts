import { useMutation, useQueryClient } from '@tanstack/react-query';
import { repostAPI } from '../api/client';

interface CreateRepostInput {
  repost_type: 'work' | 'page';
  manga_id: string;
  page_id?: string;
  episode_id?: string;
  comment?: string;
  is_spoiler: boolean;
  emotion_tags: string[];
}

export function useCreateRepost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRepostInput) => repostAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
    },
  });
}
