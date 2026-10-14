/** Shared DTO shapes — mirrored from aarohcare-backend/src/dto */

export interface LocationDto {
  lat: number;
  lng: number;
  formattedAddress?: string;
}

export interface ApiMessageResponseDto {
  message: string;
}

export interface ApiErrorResponseDto {
  message: string;
}
