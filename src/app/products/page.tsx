import { getAllProductCategories, getProducts } from "@/actions/productActions";
import { DEFAULT_PAGE_SIZE } from "../../../constant";
import PaginationSection from "@/components/PaginationSection";
import SortBy from "@/components/SortBy";
import Filter from "@/components/Filter";
import ProductTable from "@/components/ProductTable";
import { Suspense } from "react";
import { getCategories } from "@/actions/categoryActions";
import { getBrands } from "@/actions/brandActions";

export default async function Products({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const {
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
    brandId,
    categoryId,
    gender,
    occasions,
    priceRangeTo,
    sortBy,
    discount,
  } = searchParams as any;

  const categoryIds = categoryId?.split(",").filter(Boolean).map(Number) || [];

  const filters = {
    brands: brandId?.split(",").filter(Boolean).map(Number),
    categoryId: categoryIds,
    gender,
    occasions: occasions?.split(",")?.filter(Boolean),
    price: +priceRangeTo || 0,
    sortBy,
    discount,
  };

  const {
    products: productList = [],
    lastPage,
    numOfResultsOnCurPage,
  } = await getProducts(+page, +pageSize, filters);

  const brands = await getBrands();
  const categories = await getCategories();
  const productCategories = await getAllProductCategories(productList);

  let products = productList;
  let newLastPage = lastPage;
  let totalFilteredData = numOfResultsOnCurPage;

  if (categoryIds?.length > 0) {
    products = productList.filter((x) =>
      (productCategories.get(x?.id) || []).some(({ id }) =>
        categoryIds.includes(id)
      )
    );
    newLastPage = Math.ceil(products?.length / pageSize);
    totalFilteredData = products.length;
  }

  return (
    <div className="pb-20 pt-8">
      <h1 className="text-4xl mb-8">Product List</h1>
      <div className="mb-8">
        <SortBy />
        <div className="mt-4">
          <Filter categories={categories} brands={brands} />
        </div>
      </div>

      <h1 className="text-lg font-bold mb-4">Products</h1>
      <Suspense
        fallback={<p className="text-gray-300 text-2xl">Loading Products...</p>}
      >
        <ProductTable
          products={products}
          numOfResultsOnCurPage={totalFilteredData}
        />
      </Suspense>
      {products.length > 0 && (
        <PaginationSection
          lastPage={newLastPage}
          pageNo={+page}
          pageSize={+pageSize}
        />
      )}
    </div>
  );
}
