import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { facilitiesService } from '@/api/services/facilities';
import { QUERY_KEYS } from '@/constants/queryKeys';
import type { UpdateFacilityRequestDto } from '@/types/dto';

export const useMyFacility = () =>
  useQuery({
    queryKey: QUERY_KEYS.facility.mine(),
    queryFn: facilitiesService.mine,
  });

export const useUpdateMyFacility = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateFacilityRequestDto) => facilitiesService.updateMine(body),
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEYS.facility.mine(), data);
    },
  });
};
