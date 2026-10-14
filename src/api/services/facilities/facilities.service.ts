import { apiClient } from '@/api/client';
import { API_PATHS } from '@/constants/paths';
import type { FacilityResponseDto, UpdateFacilityRequestDto } from '@/types/dto';

export const facilitiesService = {
  mine: async (): Promise<FacilityResponseDto> => {
    const { data } = await apiClient.get<FacilityResponseDto>(API_PATHS.FACILITIES.MINE);
    return data;
  },

  updateMine: async (body: UpdateFacilityRequestDto): Promise<FacilityResponseDto> => {
    const { data } = await apiClient.patch<FacilityResponseDto>(
      API_PATHS.FACILITIES.MINE,
      body,
    );
    return data;
  },
};
