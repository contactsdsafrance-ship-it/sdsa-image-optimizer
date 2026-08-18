import { useLoaderData, Form } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(`
    query ProductsWithImages {
      products(first: 50) {
        nodes {
          id
          title
          media(first: 20, query: "media_type:IMAGE") {
            nodes {
              ... on MediaImage {
                id
                alt
                image {
                  url
                  altText
                  width
                  height
                }
              }
            }
          }
        }
      }
    }
  `);

  const data = await response.json();

  const products = data?.data?.products?.nodes || [];

  let imageCount = 0;
  let imagesWithoutAlt = 0;

  const analyzedProducts = products.map((product) => {
    const images = product.media?.nodes || [];

    imageCount += images.length;

    const analyzedImages = images.map((media) => {
      const image = media.image;
      const altText = media.alt || image?.altText || "";

      if (!altText) {
        imagesWithoutAlt++;
      }

      return {
        id: media.id,
        url: image?.url || "",
        altText,
        width: image?.width || 0,
        height: image?.height || 0,
      };
    });

    return {
      id: product.id,
      title: product.title,
      images: analyzedImages,
    };
  });

  return {
    products: analyzedProducts,
    stats: {
      products: analyzedProducts.length,
      images: imageCount,
      imagesWithoutAlt,
    },
  };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const formData = await request.formData();

  const mediaId = formData.get("mediaId");
  const alt = formData.get("alt");

  if (!mediaId || !alt) {
    return {
      success: false,
      error: "Informations manquantes.",
    };
  }

  const response = await admin.graphql(
    `#graphql
      mutation fileUpdate($files: [FileUpdateInput!]!) {
        fileUpdate(files: $files) {
          files {
            id
            alt
            fileStatus
          }
          userErrors {
            field
            message
            code
          }
        }
      }
    `,
    {
      variables: {
        files: [
          {
            id: mediaId,
            alt: alt,
          },
        ],
      },
    }
  );

  const data = await response.json();

  const result = data?.data?.fileUpdate;

  if (result?.userErrors?.length) {
    return {
      success: false,
      error: result.userErrors[0].message,
    };
  }

  return {
    success: true,
  };
};

export default function Index() {
  const { products, stats } = useLoaderData();

  return (
    <div
      style={{
        padding: "32px",
        maxWidth: "1400px",
        margin: "0 auto",
      }}
    >
      <h1
        style={{
          fontSize: "28px",
          marginBottom: "10px",
        }}
      >
        SDSA Image Optimizer
      </h1>

      <p
        style={{
          fontSize: "16px",
          color: "#666",
          marginBottom: "30px",
        }}
      >
        Analysez et optimisez les images de vos produits.
      </p>

      {/* STATISTIQUES */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "20px",
          marginBottom: "35px",
        }}
      >
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: "12px",
            padding: "24px",
          }}
        >
          <div
            style={{
              fontSize: "32px",
              fontWeight: "bold",
            }}
          >
            {stats.products}
          </div>

          <div>Produits analysés</div>
        </div>

        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: "12px",
            padding: "24px",
          }}
        >
          <div
            style={{
              fontSize: "32px",
              fontWeight: "bold",
            }}
          >
            {stats.images}
          </div>

          <div>Images</div>
        </div>

        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: "12px",
            padding: "24px",
          }}
        >
          <div
            style={{
              fontSize: "32px",
              fontWeight: "bold",
            }}
          >
            {stats.imagesWithoutAlt}
          </div>

          <div>Images sans ALT</div>
        </div>
      </div>

      {/* IMAGES */}

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "20px",
            borderBottom: "1px solid #ddd",
            fontSize: "20px",
            fontWeight: "bold",
          }}
        >
          Images des produits
        </div>

        {products.length === 0 ? (
          <div style={{ padding: "30px" }}>
            Aucun produit trouvé.
          </div>
        ) : (
          products.map((product) => (
            <div
              key={product.id}
              style={{
                padding: "20px",
                borderBottom: "1px solid #eee",
              }}
            >
              <h2
                style={{
                  fontSize: "18px",
                  marginBottom: "15px",
                }}
              >
                {product.title}
              </h2>

              {product.images.length === 0 ? (
                <p style={{ color: "#888" }}>
                  Aucune image
                </p>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(220px, 1fr))",
                    gap: "20px",
                  }}
                >
                  {product.images.map((image) => (
                    <div
                      key={image.id}
                      style={{
                        border: "1px solid #ddd",
                        borderRadius: "10px",
                        padding: "12px",
                      }}
                    >
                      {image.url && (
                        <img
                          src={image.url}
                          alt={image.altText || product.title}
                          style={{
                            width: "100%",
                            height: "180px",
                            objectFit: "contain",
                            borderRadius: "8px",
                            background: "#f5f5f5",
                          }}
                        />
                      )}

                      <div
                        style={{
                          marginTop: "12px",
                          fontSize: "14px",
                        }}
                      >
                        <strong>Dimensions :</strong>{" "}
                        {image.width} × {image.height}px
                      </div>

                      <Form method="post">
                        <input
                          type="hidden"
                          name="productId"
                          value={product.id}
                        />

                        <input
                          type="hidden"
                          name="mediaId"
                          value={image.id}
                        />

                        <label
                          style={{
                            display: "block",
                            marginTop: "12px",
                            marginBottom: "6px",
                            fontWeight: "bold",
                            fontSize: "14px",
                          }}
                        >
                          Texte ALT
                        </label>

                        <input
                          type="text"
                          name="alt"
                          defaultValue={image.altText}
                          placeholder={`Décrire ${product.title}`}
                          style={{
                            width: "100%",
                            boxSizing: "border-box",
                            padding: "9px",
                            border: "1px solid #ccc",
                            borderRadius: "6px",
                          }}
                        />

                        <button
                          type="submit"
                          style={{
                            marginTop: "10px",
                            width: "100%",
                            padding: "10px",
                            border: "none",
                            borderRadius: "6px",
                            background: "#111",
                            color: "#fff",
                            cursor: "pointer",
                            fontWeight: "bold",
                          }}
                        >
                          Enregistrer l'ALT
                        </button>
                      </Form>

                      <div
                        style={{
                          marginTop: "8px",
                          fontSize: "14px",
                          color: image.altText
                            ? "#188038"
                            : "#d93025",
                        }}
                      >
                        {image.altText
                          ? "✓ ALT renseigné"
                          : "⚠️ ALT manquant"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
