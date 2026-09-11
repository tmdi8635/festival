"use client";

import { useRouter } from "next/navigation";
import { FileText } from "@/icons";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";

/**
 * 계약서를 못 찾았을 때.
 *
 * 남의 계약서 번호를 넣어도 서버는 403이 아니라 404를 낸다. (있다는 사실도 알리지 않는다)
 * 화면도 같은 말을 한다 — "권한이 없습니다"라고 적으면 그 번호의 문서가 있다는 뜻이 된다.
 */
const ContractNotFound = () => {
  const router = useRouter();

  return (
    <Card>
      <EmptyState
        icon={<FileText size={28} />}
        title="계약서를 찾을 수 없습니다."
        description="주소가 잘못되었거나 볼 수 없는 계약서입니다. 목록에서 다시 골라 주세요."
        action={
          <Button onClick={() => router.push("/my/contracts")}>
            계약서 목록으로
          </Button>
        }
      />
    </Card>
  );
};

export default ContractNotFound;
