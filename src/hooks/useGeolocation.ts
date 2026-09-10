"use client";

import { useCallback, useState } from "react";

export interface GeoPosition {
  latitude: number;
  longitude: number;
  /** 오차 반경 (m). 실내에서는 수십~수백 m까지 벌어진다 */
  accuracy: number;
}

export type GeoErrorKind =
  | "UNSUPPORTED"
  | "INSECURE"
  | "DENIED"
  | "UNAVAILABLE"
  | "TIMEOUT";

export interface GeoError {
  kind: GeoErrorKind;
  message: string;
}

/**
 * 실패 사유를 **사람이 읽고 다음 행동을 고를 수 있는 문장**으로 바꾼다.
 *
 * 브라우저가 주는 것은 숫자 코드 세 개뿐이라, 그대로 두면 "위치를 가져오지 못했습니다"
 * 한 문장이 된다. 그러면 권한을 껐는지 실내라 안 잡히는지 본인도 모르고,
 * 결국 전부 담당자에게 전화가 온다.
 */
const MESSAGE: Record<GeoErrorKind, string> = {
  UNSUPPORTED: "이 브라우저는 위치를 확인할 수 없습니다.",
  INSECURE:
    "보안 연결(https)이 아니라 위치를 확인할 수 없습니다. 주소를 확인해 주세요.",
  DENIED:
    "위치 권한이 꺼져 있습니다. 브라우저 설정에서 이 사이트의 위치를 허용해 주세요.",
  UNAVAILABLE:
    "위치를 잡지 못했습니다. 실내라면 창가나 건물 밖에서 다시 시도해 주세요.",
  TIMEOUT: "위치를 잡는 데 시간이 너무 걸립니다. 다시 시도해 주세요.",
};

/**
 * 현재 위치를 한 번 가져온다.
 *
 * effect로 자동 호출하지 않는다. 화면을 열자마자 권한 창이 뜨면 사람들은 반사적으로
 * 거부하고, 한 번 거부된 권한은 설정에서 직접 되돌리기 전까지 다시 물어보지 않는다.
 * **출근 버튼을 누른 그 순간에만** 묻는다.
 */
export const useGeolocation = () => {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [error, setError] = useState<GeoError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const request = useCallback((): Promise<GeoPosition | null> => {
    const fail = (kind: GeoErrorKind) => {
      setError({ kind, message: MESSAGE[kind] });
      setIsLoading(false);
      return null;
    };

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return Promise.resolve(fail("UNSUPPORTED"));
    }

    /*
      https가 아니면 브라우저가 아예 막는다. localhost만 예외다.
      터널이나 사설 IP로 열어 확인할 때 실제로 걸리는 자리라 사유를 갈라 둔다.
    */
    if (!window.isSecureContext) {
      return Promise.resolve(fail("INSECURE"));
    }

    setIsLoading(true);
    setError(null);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (result) => {
          const next: GeoPosition = {
            latitude: result.coords.latitude,
            longitude: result.coords.longitude,
            accuracy: result.coords.accuracy,
          };

          setPosition(next);
          setIsLoading(false);
          resolve(next);
        },
        (geoError) => {
          const kind: GeoErrorKind =
            geoError.code === geoError.PERMISSION_DENIED
              ? "DENIED"
              : geoError.code === geoError.TIMEOUT
                ? "TIMEOUT"
                : "UNAVAILABLE";

          resolve(fail(kind));
        },
        {
          /*
            현장 반경(수백 m) 안인지만 가리면 되므로 고정밀은 필요 없지만,
            실내에서 기지국 위치로 떨어지면 몇 km씩 튄다. 정확도를 켜 두고
            대신 시간을 넉넉히 준다.
          */
          enableHighAccuracy: true,
          timeout: 15_000,
          /* 30초 안에 잡아 둔 값은 다시 쓴다. 연속으로 누를 때 매번 기다리지 않게. */
          maximumAge: 30_000,
        },
      );
    });
  }, []);

  const reset = useCallback(() => {
    setPosition(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return { position, error, isLoading, request, reset };
};
