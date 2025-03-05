//@ts-nocheck
"use server";

import { sql } from "kysely";
import { DEFAULT_PAGE_SIZE } from "../../constant";
import { db } from "../../db";
import { InsertProducts, UpdateProducts } from "@/types";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/utils/authOptions";
import { cache } from "react";

export async function getProducts(
  pageNo = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  filters = {}
) {
  try {
    let dbQuery = db.selectFrom("products").selectAll("products");
    let totalCountQuery = db
      .selectFrom("products")
      .select(sql`COUNT(DISTINCT id)`.as("count"));

    // Apply filters
    if (filters.brands) {
      const brandQ = sql`JSON_OVERLAPS(brands, ${JSON.stringify(
        filters.brands
      )})`;
      dbQuery = dbQuery.where(brandQ);
      totalCountQuery = totalCountQuery.where(brandQ);
    }

    if (filters.gender) {
      const genderQ = sql`gender = ${filters.gender}`;
      dbQuery = dbQuery.where(genderQ);
      totalCountQuery = totalCountQuery.where(genderQ);
    }

    if (filters.price) {
      const priceQ = sql`price <= ${filters.price}`;
      dbQuery = dbQuery.where(priceQ);
      totalCountQuery = totalCountQuery.where(priceQ);
    }

    // Apply sorting
    if (filters.sortBy) {
      const [field, order] = filters.sortBy.split("-");
      dbQuery = dbQuery.orderBy(field, order);
    }

    if (filters.occasions?.length) {
      const occasionsQ = sql`(${sql.join(
        filters.occasions.map((o) => sql`FIND_IN_SET(${o}, occasion) > 0`),
        sql` OR `
      )})`;
      dbQuery = dbQuery.where(occasionsQ);
      totalCountQuery = totalCountQuery.where(occasionsQ);
    }

    if (filters.discount) {
      const [from, to] = filters.discount.split("-").map(Number);
      const discountQ = sql`discount >= ${from} AND discount <= ${to}`;
      dbQuery = dbQuery.where(discountQ);
      totalCountQuery = totalCountQuery.where(discountQ);
    }

    // Get total count and products in parallel
    const [totalCountResult, products] = await Promise.all([
      totalCountQuery.executeTakeFirst(),
      dbQuery
        .distinct()
        .offset((pageNo - 1) * pageSize)
        .limit(pageSize)
        .execute(),
    ]);

    const count = Number(totalCountResult?.count || 0);
    const lastPage = Math.ceil(count / pageSize);
    const numOfResultsOnCurPage = products.length;

    return { products, count, lastPage, numOfResultsOnCurPage };
  } catch (error) {
    console.error("Error getting products:", error);
    throw error;
  }
}

export const getProduct = cache(async function getProduct(productId: number) {
  // console.log("run");
  try {
    const product = await db
      .selectFrom("products")
      .selectAll()
      .where("id", "=", productId)
      .execute();

    return product;
  } catch (error) {
    return { error: "Could not find the product" };
  }
});

async function enableForeignKeyChecks() {
  await sql`SET foreign_key_checks = 1`.execute(db);
}

async function disableForeignKeyChecks() {
  await sql`SET foreign_key_checks = 0`.execute(db);
}

export async function deleteProduct(productId: number) {
  try {
    await disableForeignKeyChecks();
    await db
      .deleteFrom("product_categories")
      .where("product_categories.product_id", "=", productId)
      .execute();
    await db
      .deleteFrom("reviews")
      .where("reviews.product_id", "=", productId)
      .execute();

    await db
      .deleteFrom("comments")
      .where("comments.product_id", "=", productId)
      .execute();

    await db.deleteFrom("products").where("id", "=", productId).execute();

    await enableForeignKeyChecks();
    revalidatePath("/products");
    return { message: "success" };
  } catch (error) {
    return { error: "Something went wrong, Cannot delete the product" };
  }
}

export async function updateProduct(
  productId: number,
  product: UpdateProducts
) {
  try {
    await db
      .updateTable("products")
      .set({
        name: product.name,
        description: product.description,
        old_price: product.old_price,
        price: Math.round(product.old_price * (1 - product.discount / 100)),
        discount: product.discount,
        colors: product.colors,
        brands: JSON.stringify(product.brands),
        gender: product.gender,
        occasion: product.occasion,
        rating: product.rating,
        image_url: product.image_url || null,
      })
      .where("id", "=", productId)
      .execute();

    await db
      .deleteFrom("product_categories")
      .where("product_id", "=", productId)
      .execute();

    for (const categoryId of product.categories) {
      await db
        .insertInto("product_categories")
        .values({
          product_id: productId,
          category_id: categoryId,
        })
        .execute();
    }

    revalidatePath("/products");
    return { message: "success" };
  } catch (error) {
    console.error("Error updating product:", error);
    throw error;
  }
}

export async function MapBrandIdsToName(brandsId) {
  const brandsMap = new Map();
  try {
    for (let i = 0; i < brandsId.length; i++) {
      const brandId = brandsId.at(i);
      const brand = await db
        .selectFrom("brands")
        .select("name")
        .where("id", "=", +brandId)
        .executeTakeFirst();
      brandsMap.set(brandId, brand?.name);
    }
    return brandsMap;
  } catch (error) {
    throw error;
  }
}

export async function getAllProductCategories(products: any) {
  try {
    const productsId = products.map((product) => product.id);
    const categoriesMap = new Map();

    for (let i = 0; i < productsId.length; i++) {
      const productId = productsId.at(i);
      const categories = await db
        .selectFrom("product_categories")
        .innerJoin(
          "categories",
          "categories.id",
          "product_categories.category_id"
        )
        .select(["categories.id", "categories.name"])
        .where("product_categories.product_id", "=", productId)
        .execute();
      categoriesMap.set(productId, categories);
    }
    return categoriesMap;
  } catch (error) {
    throw error;
  }
}

export async function getProductCategories(productId: number) {
  try {
    const categories = await db
      .selectFrom("product_categories")
      .innerJoin(
        "categories",
        "categories.id",
        "product_categories.category_id"
      )
      .select(["categories.id", "categories.name"])
      .where("product_categories.product_id", "=", productId)
      .execute();

    return categories;
  } catch (error) {
    throw error;
  }
}

export async function addProduct(product: InsertProducts) {
  try {
    const result = await db
      .insertInto("products")
      .values({
        name: product.name,
        description: product.description,
        old_price: product.old_price,
        price: Math.round(product.old_price * (1 - product.discount / 100)),
        discount: product.discount,
        colors: product.colors,
        brands: JSON.stringify(product.brands),
        gender: product.gender,
        occasion: product.occasion,
        rating: product.rating,
        image_url: product.image_url || null,
      })
      .executeTakeFirst();

    const productId = result.insertId;

    for (const categoryId of product.categories) {
      await db
        .insertInto("product_categories")
        .values({
          product_id: productId,
          category_id: categoryId,
        })
        .execute();
    }

    revalidatePath("/products");
    return { message: "success" };
  } catch (error) {
    console.error("Error adding product:", error);
    throw error;
  }
}
