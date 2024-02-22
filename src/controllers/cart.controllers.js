import { findCartById, updateCart } from "../service/cartService.js";
import { findProductById } from "../service/productService.js";
import { createNewTicket } from "../service/ticketService.js";
import productModel from "../models/MongoDB/productsModel.js";
import CustomError from "../utils/customErrors/CustomError.js";
import { EErrors } from "../utils/customErrors/enums.js";

export const getCart = async (req, res, next) => {
    const idCart = req.user.idCart;
    //req.logger.http(`Petición llegó al controlador (getCart).`);
    try {
        const cart = await findCartById(idCart);
        const cartPopulate = await cart.populate({ path: "products.productId", model: productModel })
        //req.logger.debug(cartPopulate)
        res.status(200).json({ cartPopulate });
    } catch (error) {
        //req.logger.error(error.message)
        next(error)
    }
}

export const updateCartProducts = async (req, res, next) => {

    const idCart = req.user.idCart;
    const info = req.body;

    //req.logger.http(`Petición llegó al controlador (updateCartProducts).`);

    try {
        await updateCart(idCart, { products: info });
        return res.status(200).send("Carrito actualizado")

    } catch (error) {
        //req.logger.error(error.message)
        next(error)
    }
}

export const addProductToCart = async (req, res, next) => {
    const user = req.user
    const idProduct = req.params.pid;

    //req.logger.http(`Petición llegó al controlador (addProductToCart).`);

    try {
        const realProduct = await findProductById(idProduct);

        if (realProduct.owner && realProduct.owner.equals(user._id)) {
            return res.status(401).json({
                message: "No se puede ingresar al carrito un producto propio."
            });
        };

        if (realProduct) {
            const cart = await findCartById(user.idCart);
            const productIndex = cart.products.findIndex(product => product.productId.equals(idProduct));
            if (productIndex === -1) {
                cart.products.push({ productId: idProduct });
            } else {
                cart.products[productIndex].quantity += 1;
            }
            const updatedCart = await updateCart(user.idCart, cart);
            req.logger.debug(updatedCart)
            return res.status(200).send("Producto agregado al carrito")
        }

        //req.logger.warning(`El producto con id: ${idProduct} no existe en la base de datos.`)

    } catch (error) {
        //req.logger.error(error.message)
        next(error)
    }
}

export const updateProductQuantity = async (req, res, next) => {

    const { quantity } = req.body;
    const idCart = req.user.idCart;
    const idProduct = req.params.pid;
    const newQuantity = parseInt(quantity);

    //req.logger.http(`Petición llegó al controlador (updateProductQuantity).`);

    try {
        if (!newQuantity) {
            CustomError.createError({
                name: "Faltan campos requeridos.",
                message: "No se pudo actualizar el producto del carrito.",
                cause: "No se ha ingresado una cantidad nueva valida.",
                code: EErrors.MISSING_FIELDS_ERROR
            })
        }

        const productDB = await findProductById(idProduct)
        const cart = await findCartById(idCart);
        const productIndex = cart.products.findIndex(product => product.productId.equals(idProduct));

        if (productIndex === -1) {
            CustomError.createError({
                name: "Error en la base de datos.",
                message: "No se pudo actualizar el producto del carrito.",
                cause: "No exite el producto en el carrito.",
                code: EErrors.DATABASE_ERROR
            })
        }

        if (newQuantity > productDB.stock) {
            CustomError.createError({
                name: "Error en la base de datos.",
                message: "No se pudo actualizar el producto del carrito.",
                cause: "La nueva cantidad no puede ser mayor al stock disponible del producto",
                code: EErrors.DATABASE_ERROR
            })
        }

        cart.products[productIndex].quantity = newQuantity;
        await updateCart(idCart, cart);
        return res.status(200).send("Cantidad del producto actualizada")

    } catch (error) {
        //req.logger.error(error.message)
        next(error)
    }
}

export const deleteCartProducts = async (req, res, next) => {

    const idCart = req.user.idCart;

    //req.logger.http(`Petición llegó al controlador (deleteCartProducts).`);

    try {
        await updateCart(idCart, { products: [] });
        return res.status(200).send("Productos borrados")

    } catch (error) {
        next(error)
    }
}

export const deleteCartProduct = async (req, res, next) => {

    const idCart = req.user.idCart;
    const idProduct = req.params.pid;

    //req.logger.http(`Petición llegó al controlador (deleteCartProduct).`);

    try {
        const cart = await findCartById(idCart);
        const productIndex = cart.products.findIndex(product => product.productId.equals(idProduct));
        if (productIndex === -1) {
            CustomError.createError({
                name: "Error en la base de datos.",
                message: "No se pudo eliminar el producto del carrito.",
                cause: "No exite el producto en el carrito.",
                code: EErrors.DATABASE_ERROR
            })
        }
        cart.products.splice(productIndex, 1);
        await updateCart(idCart, cart);
        return res.status(200).send("El producto ha sido eliminado del carrito")

    } catch (error) {
        //req.logger.error(error.message)
        next(error)
    }
}

export const createTicket = async (req, res, next) => {

    const idCart = req.user.idCart;
    const purchaser = req.user.email;

    //req.logger.http(`Petición llegó al controlador (createTicket).`);

    try {
        const cart = await findCartById(idCart);
        const cartPopulate = await cart.populate({ path: "products.productId", model: productModel });

        const amount = cart.total;

        for (const productInCart of cartPopulate.products) {
            const product = productInCart.productId;
            const quantity = productInCart.quantity;
            if (quantity > product.stock) {
                const productIndex = cart.products.findIndex(product => product.productId.equals(product._id));
                cart.products.splice(productIndex, 1);
            }
        }

        const updatedCart = await updateCart(idCart, cart);

        if (updatedCart.total !== amount) {
            return res.status(400).send("Algunos productos no tienen suficiente stock");
        }

        const newTicket = await createNewTicket({amount, purchaser});

        for (const productInCart of cart.products) {
            const product = await findProductById(productInCart.productId);
            const quantity = productInCart.quantity;
            product.stock -= quantity;
            await product.save();
        }

        await updateCart(idCart, { products: [] });

        return res.status(200).send({message: "El Ticket ha sido creado", ticket: newTicket})

    } catch (error) {
        //req.logger.error(error.message)
        next(error)
    }
}