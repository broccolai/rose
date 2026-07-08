import { handleTokenRefresh, type PagesFunctionContext } from '../../../_lib/bungie-oauth';

export const onRequestPost = (context: PagesFunctionContext): Promise<Response> => handleTokenRefresh(context);
