import * as service from "../services/communityPartnershipService.js";
export async function index(req,res){res.json({success:true,data:await service.listPartnerships()});}
export async function create(req,res){res.status(201).json({success:true,data:{id:await service.createPartnership(req.user,req.body)}});}
export async function update(req,res){await service.updatePartnership(req.params.id,req.body);res.json({success:true});}
export async function remove(req,res){await service.deletePartnership(req.params.id);res.json({success:true});}
