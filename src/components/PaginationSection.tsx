"use client";

import { useRouter, useSearchParams } from "next/navigation";

function PaginationSection({
  lastPage,
  pageNo,
  pageSize,
}: {
  lastPage: number;
  pageNo: number;
  pageSize: number;
}) {
  const router = useRouter();

  const query = useSearchParams();
  const searchParams = new URLSearchParams(query.toString());

  function handlePrev() {
    if (pageNo > 1) {
      searchParams.set("page", (pageNo - 1).toString());
      router.push(`/products?${searchParams.toString()}`);
    }
  }

  function handleNext() {
    if (pageNo < lastPage) {
      searchParams.set("page", (pageNo + 1).toString());
      router.push(`/products?${searchParams.toString()}`);
    }
  }

  function handlePageSizeChange(e) {
    searchParams.set("pageSize", e.target.value);
    searchParams.set("page", "1"); // Reset to first page
    router.push(`/products?${searchParams.toString()}`);
  }

  return (
    <div className="mt-12 p-4 bg-gray-800 flex justify-center gap-4 items-center mb-8">
      <select
        value={pageSize}
        name="page-size"
        className="text-black"
        onChange={handlePageSizeChange}
      >
        {["10", "25", "50"].map((val) => {
          return (
            <option key={val} value={val}>
              {val}
            </option>
          );
        })}
      </select>
      <button
        className="p-3 bg-slate-300 text-black disabled:cursor-not-allowed"
        disabled={pageNo === 1}
        onClick={handlePrev}
      >
        &larr;Prev
      </button>
      <p>
        Page {pageNo} of {lastPage}{" "}
      </p>
      <button
        className="p-3 bg-slate-300 text-black disabled:cursor-not-allowed"
        disabled={pageNo === lastPage}
        onClick={handleNext}
      >
        Next&rarr;
      </button>
    </div>
  );
}

export default PaginationSection;
