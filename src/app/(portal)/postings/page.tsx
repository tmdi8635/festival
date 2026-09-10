import PostingBoard from "./_components/PostingBoard";

/**
 * 공고 — **로그인하지 않아도 열린다.**
 *
 * 그래서 `/my` 아래가 아니다. 처음 보는 사람에게 가입부터 시키면 그 사람은
 * 어떤 일이 있는지도 모른 채 나간다. 무엇을 하는 자리인지는 먼저 보여 주고,
 * 지원할 때 누구인지 묻는다.
 */
export default function PostingPage() {
  return <PostingBoard />;
}
