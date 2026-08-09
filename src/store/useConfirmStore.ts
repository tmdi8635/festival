import { create } from "zustand";

export interface ConfirmOptions {
  title: string;
  /** 어떤 대상에 무슨 일이 일어나는지 명시한다. */
  description?: string;
  /** 되돌릴 수 없는 작업일 때 강조해서 보여줄 경고 문구 */
  warning?: string;
  /** "확인"이 아니라 "삭제", "정지"처럼 동작 이름을 쓴다. */
  confirmText: string;
  cancelText?: string;
  tone?: "default" | "danger";
  /**
   * 확인 시 실행할 작업.
   * mutateAsync처럼 결과를 반환하는 함수를 그대로 넘길 수 있도록 반환 타입을 열어 둔다.
   */
  onConfirm: () => unknown;
}

interface ConfirmState {
  options: ConfirmOptions | null;
  isProcessing: boolean;

  openConfirm: (options: ConfirmOptions) => void;
  closeConfirm: () => void;
  setProcessing: (isProcessing: boolean) => void;
}

/**
 * 파괴적 작업 확인 다이얼로그는 화면마다 만들지 않고 이 스토어로만 연다.
 * 실제 렌더링은 ConfirmDialogHost가 담당한다.
 */
export const useConfirmStore = create<ConfirmState>((set) => ({
  options: null,
  isProcessing: false,

  openConfirm: (options) => set({ options, isProcessing: false }),
  closeConfirm: () => set({ options: null, isProcessing: false }),
  setProcessing: (isProcessing) => set({ isProcessing }),
}));

/** 화면에서 호출하는 단축 함수 */
export const openConfirm = (options: ConfirmOptions) =>
  useConfirmStore.getState().openConfirm(options);
