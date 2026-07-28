import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import postsRouter from "./posts";
import matchRouter from "./match";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(postsRouter);
router.use(matchRouter);

export default router;
