import { handleTokenExchange, type PagesFunctionContext } from '../../../_lib/bungie-oauth';

export const onRequestPost = (context: PagesFunctionContext): Promise<Response> => handleTokenExchange(context);
