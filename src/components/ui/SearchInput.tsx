"use client";

import { ComponentPropsWithoutRef, FormEvent, useState } from "react";
import { Close, Search } from "@/icons";
import { cn } from "@/lib/utils";
import IconButton from "./IconButton";
import Input from "./Input";

interface SearchInputProps
  extends Omit<ComponentPropsWithoutRef<"input">, "onSubmit" | "value"> {
  /** 확정된 검색어. Enter 또는 초기화 시에만 갱신된다. */
  value: string;
  onSearch: (keyword: string) => void;
  boxClassName?: string;
}

/**
 * 목록 화면 공통 검색 입력.
 * 타이핑마다 조회하지 않고 Enter 시점에만 onSearch를 호출한다.
 */
const SearchInput = ({
  value,
  onSearch,
  placeholder = "검색어를 입력하세요",
  boxClassName,
  className,
  ...props
}: SearchInputProps) => {
  const [keyword, setKeyword] = useState(value);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSearch(keyword.trim());
  };

  const handleClear = () => {
    setKeyword("");
    onSearch("");
  };

  return (
    <form onSubmit={handleSubmit} className={cn("w-70", boxClassName)}>
      <Input
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        placeholder={placeholder}
        leftIcon={<Search size={16} />}
        rightSlot={
          keyword && (
            <IconButton
              label="검색어 지우기"
              icon={<Close size={14} />}
              size="sm"
              onClick={handleClear}
              className="-mr-1.5 size-6"
            />
          )
        }
        className={className}
        {...props}
      />
    </form>
  );
};

export default SearchInput;
