import { findProductById, createProduct, updateOneProduct, paginateProducts, deleteOneProduct } from "../service/productService.js";
import CustomError from "../utils/customErrors/CustomError.js";
import { generateProductErrorInfo } from "../utils/customErrors/info.js";
import { EErrors } from "../utils/customErrors/enums.js";

export const getProducts = async (req, res, next) => {
    const { limit = 10, page = 1, sort = "", category = "" } = req.query;

    //req.logger.http(`Petición llegó al controlador (getProducts).`);

    const filters = { stock: { $gt: 0 } };
    if (category) filters.category = category;

    const options = {
        page: parseInt(page),
        limit: parseInt(limit),
    };
    if (sort) options.sort = { price: sort === 'desc' ? -1 : 1 }

    try {
        const products = await paginateProducts(filters, options);

        const prevLink = products.hasPrevPage ? `/api/products?category=${category}&limit=${limit}&sort=${sort}&page=${products.prevPage}` : null
        const nextLink = products.hasNextPage ? `/api/products?category=${category}&limit=${limit}&sort=${sort}&page=${products.nextPage}` : null

        return res.status(200).send({
            status: "success",
            payload: products.docs,
            totalPages: products.totalPages,
            prevPage: products.prevPage,
            nextPage: products.nextPage,
            page: products.page,
            hasPrevPage: products.hasPrevPage,
            hasNextPage: products.hasNextPage,
            prevLink: prevLink,
            nextLink: nextLink
        })
    } catch (error) {
        next(error)
    }
}

export const getProduct = async (req, res, next) => {
    const idProduct = req.params.pid;

    //req.logger.http(`Petición llegó al controlador (getProduct).`);

    try {
        const product = await findProductById(idProduct);

        if (product) {
            //req.logger.debug(product)
            return res.status(200).json(product)
        }

        //req.logger.warning("No se encontro el producto")
        return res.status(401).json({ message: "No se encontro el producto" })

    } catch (error) {
        next(error)
    }
}

export const postProduct = async (req, res, next) => {
    const user = req.user
    const productInfo = req.body;

    //req.logger.http(`Petición llegó al controlador`);
    try {
        const requiredFields = ['title', 'description', 'price', 'code', 'stock', 'category'];
        if (requiredFields.every((field) => productInfo[field])) {
            if (user.role === 'premium') {
                productInfo.owner = user._id;
            }
            const product = await createProduct(productInfo);
            res.status(200).send({
                message: 'Producto agregado correctamente',
                product: product
            });
        } else {
            CustomError.createError({
                name: "Error creando el Producto",
                message: "No se pudo crear el producto",
                cause: generateProductErrorInfo(productInfo),
                code: EErrors.MISSING_FIELDS_ERROR
            })
        }

    } catch (error) {
        //req.logger.error(error.message)
        next(error)
    }
}

export const updateProduct = async (req, res, next) => {
    const user = req.user
    const idProduct = req.params.pid;
    const info = req.body;

    //req.logger.http(`Petición llegó al controlador (updateProduct).`);

    try {
        if (user.role === "admin") {
            await updateOneProduct(idProduct, info);

            return res.status(200).json({
                message: "Producto actualizado"
            });
        }

        const product = await findProductById(idProduct);

        //req.logger.debug(user._id)
        //req.logger.debug(product.owner)

        if (user.role === "premium" && user._id.equals(product.owner)) {
            await updateOneProduct(idProduct, info);

            return res.status(200).json({
                message: "Producto actualizado"
            });
        }

        return res.status(401).json({
            message: "No posee los permisos necesarios"
        });

    } catch (error) {
        //req.logger.error(error.message)
        next(error)
    }
}

export const deleteProduct = async (req, res, next) => {
    const user = req.user;
    const idProduct = req.params.pid;

    //req.logger.http(`Petición llegó al controlador (deleteProduct).`);

    try {
        if (user.role === "admin") {
            await deleteOneProduct(idProduct);

            return res.status(200).json({
                message: "Producto eliminado"
            });
        }

        const product = await findProductById(idProduct);

        if (user.role === "premium" && user._id.equals(product.owner)) {
            await deleteOneProduct(idProduct);

            return res.status(200).json({
                message: "Producto eliminado"
            });
        }

        return res.status(401).json({
            message: "No posee los permisos necesarios"
        });

    } catch (error) {
        //req.logger.error(error.message)
        next(error)
    }
}